package com.skylia.auth.service.impl;

import com.skylia.auth.dto.response.LoginResponse;
import com.skylia.auth.service.AuthService;
import com.skylia.auth.service.EmailService;
import com.skylia.auth.service.PhoneRegistrationCodeService;
import com.skylia.auth.service.SmsService;
import com.skylia.auth.service.sms.SmsScene;
import com.skylia.auth.security.VerificationAttemptGuard;
import com.skylia.common.core.exception.BizException;
import com.skylia.common.core.result.ResultCode;
import com.skylia.common.redis.RedisService;
import com.skylia.common.security.activity.InternalActivityRecorder;
import com.skylia.common.security.utils.JwtUtils;
import com.skylia.user.api.UserFeignClient;
import com.skylia.user.api.dto.EmailRegistrationRequest;
import com.skylia.user.api.dto.PhoneRegistrationRequest;
import com.skylia.user.api.dto.UserDTO;
import com.skylia.common.core.result.Result;
import feign.FeignException;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Random;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final RedisService redisService;
    private final UserFeignClient userFeignClient;
    private final EmailService emailService;
    private final SmsService smsService;
    private final PhoneRegistrationCodeService phoneRegistrationCodeService;
    private final InternalActivityRecorder activityRecorder;
    private final VerificationAttemptGuard verificationAttemptGuard;

    @Value("${skylia.jwt.secret}")
    private String jwtSecret;

    @Value("${skylia.jwt.access-token-expiration:7200000}")
    private long accessTokenExpiration;

    @Value("${skylia.jwt.refresh-token-expiration:604800000}")
    private long refreshTokenExpiration;

    @Value("${skylia.email.code-expire-minutes:5}")
    private int codeExpireMinutes;

    @Value("${skylia.email.send-interval-seconds:60}")
    private int sendIntervalSeconds;

    @Value("${skylia.auth.local-test-code-enabled:false}")
    private boolean localTestCodeEnabled;

    private static final String EMAIL_CODE_PREFIX = "email:code:";
    private static final String EMAIL_LIMIT_PREFIX = "email:limit:";
    private static final String PHONE_LIMIT_PREFIX = "phone:limit:";
    private static final String TOKEN_BLACKLIST_PREFIX = "token:blacklist:";
    private static final String REFRESH_SESSION_PREFIX = "refresh:session:";
    private static final String LOCAL_TEST_CODE = "123456";

    // ======================== 邮箱通道（保留原逻辑） ========================

    @Override
    public void sendVerificationCode(String email) {
        String limitKey = EMAIL_LIMIT_PREFIX + email;
        checkCooldown(limitKey);

        Result<UserDTO> existing = userFeignClient.getByEmail(email);
        if (existing == null || !existing.isSuccess() || existing.getData() == null) {
            log.warn("拒绝向未注册邮箱发送登录验证码: email={}", maskEmail(email));
            throw new BizException(ResultCode.EMAIL_NOT_REGISTERED_FOR_LOGIN);
        }
        validateLoginAllowed(existing.getData().getId());

        String code = generateCode();
        log.info("发送登录验证码: email={}", maskEmail(email));

        String codeKey = EMAIL_CODE_PREFIX + email;
        verificationAttemptGuard.reset("email-login", email);
        redisService.set(codeKey, code, codeExpireMinutes, TimeUnit.MINUTES);

        try {
            emailService.sendVerificationCode(email, code);
            redisService.set(limitKey, "1", sendIntervalSeconds, TimeUnit.SECONDS);
            log.info("登录验证码邮件发送成功: email={}", maskEmail(email));
        } catch (BizException e) {
            redisService.delete(codeKey);
            throw e;
        } catch (Exception e) {
            redisService.delete(codeKey);
            log.error("登录验证码邮件发送失败: email={}, error={}", maskEmail(email), e.getMessage());
            throw new BizException(ResultCode.THIRD_PARTY_ERROR.getCode(), "验证码发送失败，请稍后重试");
        }
    }

    @Override
    public void sendRegistrationCode(String email, String inviteCode) {
        String limitKey = EMAIL_LIMIT_PREFIX + email;
        checkCooldown(limitKey);

        rejectExistingEmailRegistration(email);

        EmailRegistrationRequest req = EmailRegistrationRequest.builder()
                .email(email).inviteCode(inviteCode).build();
        Result<Void> ok;
        try {
            ok = userFeignClient.validateEmailRegistration(req);
        } catch (FeignException e) {
            throw normalizeRegistrationFeignException(e, false);
        }
        if (ok == null || !ok.isSuccess()) {
            int c = ok != null ? ok.getCode() : ResultCode.SYSTEM_ERROR.getCode();
            String m = ok != null ? ok.getMessage() : "用户服务异常";
            throw new BizException(c, m);
        }

        String code = generateCode();
        String codeKey = EMAIL_CODE_PREFIX + email;
        verificationAttemptGuard.reset("email-register", email);
        redisService.set(codeKey, code, codeExpireMinutes, TimeUnit.MINUTES);

        try {
            emailService.sendVerificationCode(email, code);
            redisService.set(limitKey, "1", sendIntervalSeconds, TimeUnit.SECONDS);
            log.info("注册验证码邮件发送成功: email={}", maskEmail(email));
        } catch (BizException e) {
            redisService.delete(codeKey);
            throw e;
        } catch (Exception e) {
            redisService.delete(codeKey);
            throw new BizException(ResultCode.THIRD_PARTY_ERROR.getCode(), "验证码发送失败，请稍后重试");
        }
    }

    @Override
    public LoginResponse loginByCode(String email, String code) {
        validateCode("email-login", EMAIL_CODE_PREFIX + email, email, code);

        Result<UserDTO> existing = userFeignClient.getByEmail(email);
        if (existing == null || !existing.isSuccess() || existing.getData() == null) {
            throw new BizException(ResultCode.EMAIL_NOT_REGISTERED_FOR_LOGIN);
        }

        UserDTO user = existing.getData();
        user = completeLogin(user.getId());
        return buildLoginResponse(user, email, false);
    }

    @Override
    public LoginResponse registerByCode(String email, String code, String inviteCode) {
        rejectExistingEmailRegistration(email);
        validateCode("email-register", EMAIL_CODE_PREFIX + email, email, code);

        EmailRegistrationRequest req = EmailRegistrationRequest.builder()
                .email(email).inviteCode(inviteCode).build();
        Result<UserDTO> reg;
        try {
            reg = userFeignClient.registerByEmail(req);
        } catch (FeignException e) {
            throw normalizeRegistrationFeignException(e, false);
        }
        if (reg == null || !reg.isSuccess()) {
            int c = reg != null ? reg.getCode() : ResultCode.SYSTEM_ERROR.getCode();
            String m = reg != null ? reg.getMessage() : "用户服务异常";
            throw new BizException(c, m);
        }

        return buildLoginResponse(reg.getData(), email, true);
    }

    // ======================== 手机号通道（登录走 PNVS，注册走标准短信 + Redis） ========================

    @Override
    public void sendPhoneVerificationCode(String phone) {
        String limitKey = PHONE_LIMIT_PREFIX + phone;
        checkCooldown(limitKey);

        Result<UserDTO> existing = userFeignClient.getByPhone(phone);
        if (existing == null || !existing.isSuccess() || existing.getData() == null) {
            log.warn("拒绝向未注册手机号发送登录验证码: phone=***");
            throw new BizException(ResultCode.USER_NOT_FOUND.getCode(), "该手机号尚未注册，请先注册");
        }
        validateLoginAllowed(existing.getData().getId());

        verificationAttemptGuard.reset("phone-login", phone);
        smsService.sendVerificationCode(phone, SmsScene.LOGIN, existing.getData().getId());
        redisService.set(limitKey, "1", sendIntervalSeconds, TimeUnit.SECONDS);
        log.info("登录验证码短信发送成功: phone=***");
    }

    @Override
    public void sendPhoneRegistrationCode(String phone, String inviteCode) {
        String limitKey = PHONE_LIMIT_PREFIX + phone;
        checkCooldown(limitKey);

        rejectExistingPhoneRegistration(phone);

        PhoneRegistrationRequest req = PhoneRegistrationRequest.builder()
                .phone(phone).inviteCode(inviteCode).build();
        Result<Void> ok;
        try {
            ok = userFeignClient.validatePhoneRegistration(req);
        } catch (FeignException e) {
            throw normalizeRegistrationFeignException(e, true);
        }
        if (ok == null || !ok.isSuccess()) {
            int c = ok != null ? ok.getCode() : ResultCode.SYSTEM_ERROR.getCode();
            String m = ok != null ? ok.getMessage() : "用户服务异常";
            throw new BizException(c, m);
        }

        phoneRegistrationCodeService.send(phone);
        redisService.set(limitKey, "1", sendIntervalSeconds, TimeUnit.SECONDS);
        log.info("注册验证码短信发送成功: phone=***");
    }

    @Override
    public LoginResponse loginByPhoneCode(String phone, String code) {
        validatePhoneCode(phone, code);

        Result<UserDTO> existing = userFeignClient.getByPhone(phone);
        if (existing == null || !existing.isSuccess() || existing.getData() == null) {
            throw new BizException(ResultCode.USER_NOT_FOUND.getCode(), "该手机号尚未注册");
        }

        UserDTO user = existing.getData();
        user = completeLogin(user.getId());
        String identifier = user.getPhone() != null ? user.getPhone() : String.valueOf(user.getId());
        return buildLoginResponse(user, identifier, false);
    }

    @Override
    public LoginResponse registerByPhoneCode(String phone, String code, String inviteCode) {
        rejectExistingPhoneRegistration(phone);
        validatePhoneRegistrationCode(phone, code);

        PhoneRegistrationRequest req = PhoneRegistrationRequest.builder()
                .phone(phone).inviteCode(inviteCode).build();
        Result<UserDTO> reg;
        try {
            reg = userFeignClient.registerByPhone(req);
        } catch (FeignException e) {
            throw normalizeRegistrationFeignException(e, true);
        }
        if (reg == null || !reg.isSuccess()) {
            int c = reg != null ? reg.getCode() : ResultCode.SYSTEM_ERROR.getCode();
            String m = reg != null ? reg.getMessage() : "用户服务异常";
            throw new BizException(c, m);
        }

        return buildLoginResponse(reg.getData(), phone, true);
    }

    // ======================== Token 管理 ========================

    @Override
    public LoginResponse refreshToken(String refreshToken) {
        Claims claims;
        try {
            claims = JwtUtils.parseToken(refreshToken, jwtSecret);
        } catch (Exception e) {
            throw new BizException(ResultCode.TOKEN_INVALID);
        }
        if (!JwtUtils.hasTokenType(claims, JwtUtils.TOKEN_TYPE_REFRESH)
                || claims.getId() == null
                || Boolean.TRUE.equals(redisService.hasKey(TOKEN_BLACKLIST_PREFIX + claims.getId()))) {
            throw new BizException(ResultCode.TOKEN_INVALID);
        }

        Long userId = JwtUtils.getUserId(refreshToken, jwtSecret);
        String activeRefreshId = redisService.get(REFRESH_SESSION_PREFIX + userId);
        if (!claims.getId().equals(activeRefreshId)) {
            throw new BizException(ResultCode.TOKEN_INVALID);
        }
        Result<UserDTO> userResult = userFeignClient.getById(userId);
        if (!userResult.isSuccess() || userResult.getData() == null) {
            throw new BizException(ResultCode.USER_NOT_FOUND);
        }

        UserDTO user = userResult.getData();
        validateActiveSession(user.getId());
        long ttl = claims.getExpiration().getTime() - System.currentTimeMillis();
        Boolean firstUse = ttl > 0
                ? redisService.setIfAbsent(
                        TOKEN_BLACKLIST_PREFIX + claims.getId(), "1", ttl, TimeUnit.MILLISECONDS)
                : Boolean.FALSE;
        if (!Boolean.TRUE.equals(firstUse)) {
            throw new BizException(ResultCode.TOKEN_INVALID);
        }
        String identifier = user.getEmail() != null ? user.getEmail() : user.getPhone();
        return buildLoginResponse(user, identifier, null);
    }

    @Override
    public void logout(String token) {
        try {
            String tokenId = JwtUtils.getTokenId(token, jwtSecret);
            long expiration = JwtUtils.getExpiration(token, jwtSecret);
            long ttl = expiration - System.currentTimeMillis();
            if (ttl > 0) {
                redisService.set(TOKEN_BLACKLIST_PREFIX + tokenId, "1", ttl, TimeUnit.MILLISECONDS);
            }
            Long userId = JwtUtils.getUserId(token, jwtSecret);
            redisService.delete(REFRESH_SESSION_PREFIX + userId);
            log.info("用户已退出登录");
        } catch (Exception e) {
            log.warn("退出登录处理失败: {}", e.getMessage());
        }
    }

    // ======================== 内部工具方法 ========================

    /**
     * 手机验证码校验 —— 调用 Aliyun PNVS CheckSmsVerifyCode。
     */
    private void validatePhoneCode(String phone, String code) {
        if (isLocalTestCode(code)) {
            return;
        }
        verificationAttemptGuard.assertAllowed("phone-login", phone);
        boolean passed = smsService.checkVerificationCode(phone, code, SmsScene.LOGIN);
        if (!passed) {
            verificationAttemptGuard.recordFailure("phone-login", phone);
            throw new BizException(ResultCode.VERIFICATION_CODE_ERROR);
        }
        verificationAttemptGuard.reset("phone-login", phone);
    }

    private void validatePhoneRegistrationCode(String phone, String code) {
        if (isLocalTestCode(code)) {
            return;
        }
        phoneRegistrationCodeService.verifyAndConsume(phone, code);
    }

    private void checkCooldown(String limitKey) {
        if (redisService.hasKey(limitKey)) {
            Long ttl = redisService.getExpire(limitKey);
            throw new BizException(ResultCode.SEND_CODE_TOO_FREQUENT.getCode(),
                    String.format("请%d秒后再试", ttl));
        }
    }

    private void validateCode(String scope, String codeKey, String subject, String code) {
        if (isLocalTestCode(code)) {
            return;
        }
        verificationAttemptGuard.assertAllowed(scope, subject);
        String savedCode = redisService.get(codeKey);
        if (savedCode == null) {
            throw new BizException(ResultCode.VERIFICATION_CODE_EXPIRED);
        }
        if (!savedCode.equals(code)) {
            verificationAttemptGuard.recordFailure(scope, subject);
            throw new BizException(ResultCode.VERIFICATION_CODE_ERROR);
        }
        redisService.delete(codeKey);
        verificationAttemptGuard.reset(scope, subject);
    }

    private boolean isLocalTestCode(String code) {
        return localTestCodeEnabled && LOCAL_TEST_CODE.equals(code);
    }

    private void validateLoginAllowed(Long userId) {
        Result<Void> result = userFeignClient.validateLoginAllowed(userId);
        if (result == null || !result.isSuccess()) {
            throw new BizException(result != null ? result.getCode() : ResultCode.SYSTEM_ERROR.getCode(),
                    result != null ? result.getMessage() : "用户服务异常");
        }
    }

    private UserDTO completeLogin(Long userId) {
        Result<UserDTO> result = userFeignClient.completeLogin(userId);
        if (result == null || !result.isSuccess() || result.getData() == null) {
            throw new BizException(result != null ? result.getCode() : ResultCode.SYSTEM_ERROR.getCode(),
                    result != null ? result.getMessage() : "用户服务异常");
        }
        return result.getData();
    }

    private void validateActiveSession(Long userId) {
        Result<Void> result = userFeignClient.validateActiveSession(userId);
        if (result == null || !result.isSuccess()) {
            throw new BizException(result != null ? result.getCode() : ResultCode.SYSTEM_ERROR.getCode(),
                    result != null ? result.getMessage() : "用户服务异常");
        }
    }

    private void rejectExistingEmailRegistration(String email) {
        Result<UserDTO> existing = userFeignClient.getByEmail(email);
        if (existing != null && existing.isSuccess() && existing.getData() != null) {
            throw new BizException(ResultCode.USER_ALREADY_EXISTS.getCode(), "该邮箱已注册，请前往登录页登录");
        }
    }

    private void rejectExistingPhoneRegistration(String phone) {
        Result<UserDTO> existing = userFeignClient.getByPhone(phone);
        if (existing != null && existing.isSuccess() && existing.getData() != null) {
            throw new BizException(ResultCode.PHONE_ALREADY_REGISTERED.getCode(), "该手机号已注册，请前往登录页登录");
        }
    }

    private BizException normalizeRegistrationFeignException(FeignException e, boolean phoneChannel) {
        String body = "";
        try {
            body = e.contentUTF8();
        } catch (Exception ignored) {
            // Feign may not expose a response body for network/proxy failures.
        }
        String message = body == null || body.isBlank() ? e.getMessage() : body;
        String lower = message == null ? "" : message.toLowerCase();

        if (phoneChannel) {
            if (messageContains(message, "手机号已注册") || lower.contains("\"code\":3004")) {
                return new BizException(ResultCode.PHONE_ALREADY_REGISTERED.getCode(), "该手机号已注册，请前往登录页登录");
            }
        } else if (messageContains(message, "邮箱已注册") ||
                messageContains(message, "该账号已注册") ||
                lower.contains("\"code\":3003")) {
            return new BizException(ResultCode.USER_ALREADY_EXISTS.getCode(), "该邮箱已注册，请前往登录页登录");
        }

        if (messageContains(message, "内测名额已满") || lower.contains("\"code\":3013")) {
            return new BizException(ResultCode.BETA_FULL);
        }

        log.warn("注册发码前置校验调用用户服务失败: status={}, body={}", e.status(), abbreviate(message, 240));
        return new BizException(ResultCode.SERVICE_UNAVAILABLE.getCode(), "注册校验暂时不可用，请稍后重试");
    }

    private boolean messageContains(String message, String expected) {
        return message != null && message.contains(expected);
    }

    private String abbreviate(String value, int maxLength) {
        if (value == null) {
            return "";
        }
        String oneLine = value.replace('\r', ' ').replace('\n', ' ').trim();
        if (oneLine.length() <= maxLength) {
            return oneLine;
        }
        return oneLine.substring(0, maxLength) + "...";
    }

    private LoginResponse buildLoginResponse(UserDTO user, String identifier, Boolean isNewUser) {
        String accessToken = JwtUtils.generateAccessToken(
                user.getId(), identifier, jwtSecret, accessTokenExpiration);
        String refreshToken = JwtUtils.generateRefreshToken(
                user.getId(), jwtSecret, refreshTokenExpiration);
        String refreshTokenId = JwtUtils.getTokenId(refreshToken, jwtSecret);
        redisService.set(
                REFRESH_SESSION_PREFIX + user.getId(),
                refreshTokenId,
                refreshTokenExpiration,
                TimeUnit.MILLISECONDS);

        log.info("用户认证成功: userId={}, isNew={}", user.getId(), isNewUser);
        String eventType = Boolean.TRUE.equals(isNewUser)
                ? "ACCOUNT_REGISTERED"
                : (isNewUser == null ? "TOKEN_REFRESHED" : "ACCOUNT_LOGIN_SUCCEEDED");
        String summary = Boolean.TRUE.equals(isNewUser)
                ? "用户完成注册并登录"
                : (isNewUser == null ? "用户刷新登录状态" : "用户登录成功");
        activityRecorder.record(user.getId(), user.getId(), null, "USER",
                eventType, summary, null);

        return LoginResponse.builder()
                .userId(user.getId())
                .email(user.getEmail())
                .phone(user.getPhone())
                .nickname(user.getNickname())
                .avatarUrl(user.getAvatarUrl())
                .gender(user.getGender())
                .role(user.getRole())
                .displayName(user.getDisplayName())
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .expiresIn(accessTokenExpiration / 1000)
                .isNewUser(isNewUser)
                .build();
    }

    private String generateCode() {
        return String.format("%06d", new Random().nextInt(1000000));
    }

    private String maskEmail(String email) {
        if (email == null || email.isBlank() || !email.contains("@")) {
            return "***";
        }
        String[] parts = email.split("@", 2);
        String name = parts[0];
        String masked = name.length() <= 2 ? name.charAt(0) + "***" : name.substring(0, 2) + "***";
        return masked + "@" + parts[1];
    }
}
