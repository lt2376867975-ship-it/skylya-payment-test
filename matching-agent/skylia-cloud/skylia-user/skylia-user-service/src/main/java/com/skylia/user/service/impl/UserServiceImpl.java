package com.skylia.user.service.impl;

import cn.hutool.core.util.IdUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.skylia.common.core.constant.CommonConstants;
import com.skylia.common.core.exception.BizException;
import com.skylia.common.core.result.Result;
import com.skylia.common.core.result.ResultCode;
import com.skylia.common.security.crypto.BlindIndexService;
import com.skylia.common.security.crypto.CryptoService;
import com.skylia.match.api.MatchFeignClient;
import com.skylia.profile.api.ProfileFeignClient;
import com.skylia.profile.api.dto.UserProfileDTO;
import com.skylia.user.api.dto.UserDTO;
import com.skylia.user.domain.entity.AccountDeletionArchive;
import com.skylia.user.domain.entity.User;
import com.skylia.user.domain.entity.UserAuth;
import com.skylia.user.mapper.AccountDeletionArchiveMapper;
import com.skylia.user.mapper.UserAuthMapper;
import com.skylia.user.mapper.UserMapper;
import com.skylia.user.service.UserService;
import com.skylia.user.service.UserFeedbackService;
import com.skylia.user.service.PaidInviteCodeService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;
    private final UserAuthMapper userAuthMapper;
    private final AccountDeletionArchiveMapper accountDeletionArchiveMapper;
    private final ProfileFeignClient profileFeignClient;
    private final MatchFeignClient matchFeignClient;
    private final CryptoService cryptoService;
    private final BlindIndexService blindIndexService;
    private final PaidInviteCodeService paidInviteCodeService;
    private final UserFeedbackService userFeedbackService;

    @Value("${skylia.beta.max-users:150}")
    private int betaMaxUsers;

    private static final String TYPE_PHONE = "phone";
    private static final String TYPE_EMAIL = "email";
    private static final String TYPE_OPEN_ID = "open_id";
    private static final int ACCOUNT_DELETION_GRACE_DAYS = 30;
    private static final String ACCOUNT_ARCHIVE_REASON_GRACE_EXPIRED = "GRACE_EXPIRED";

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}$");
    private static final Pattern CN_PHONE_PATTERN = Pattern.compile("^1\\d{10}$");
    private static final ExecutorService PROFILE_INIT_EXECUTOR = Executors.newFixedThreadPool(2, runnable -> {
        Thread thread = new Thread(runnable, "skylia-profile-init");
        thread.setDaemon(true);
        return thread;
    });

    @Override
    public User getById(Long id) {
        return userMapper.selectById(id);
    }

    @Override
    public List<User> getByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return Collections.emptyList();
        return userMapper.selectBatchIds(ids);
    }

    @Override
    public User getByPhone(String phone) {
        return findUserByIdentity(TYPE_PHONE, phone);
    }

    @Override
    @Transactional
    public User getOrCreateByPhone(String phone) {
        User user = findUserByIdentity(TYPE_PHONE, phone);
        if (user == null) {
            user = createUser(phone);
        } else {
            updateLastLoginTime(user.getId());
        }
        return user;
    }

    @Override
    public User getByEmail(String email) {
        return findUserByIdentity(TYPE_EMAIL, email);
    }

    @Override
    @Transactional
    public User getOrCreateByEmail(String email) {
        User user = findUserByIdentity(TYPE_EMAIL, email);
        if (user == null) {
            user = createUserByEmail(email);
        } else {
            updateLastLoginTime(user.getId());
        }
        return user;
    }

    @Override
    public void validateEmailRegistration(String email, String inviteCode) {
        String normalizedEmail = email != null ? email.trim() : "";
        if (findUserByIdentity(TYPE_EMAIL, normalizedEmail) != null) {
            throw new BizException(ResultCode.USER_ALREADY_EXISTS, "该邮箱已注册，请前往登录页登录");
        }

        checkBetaCapacity();
        paidInviteCodeService.validateAvailable(inviteCode);
    }

    @Override
    @Transactional
    public User registerByEmail(String email, String inviteCode) {
        String normalizedEmail = email != null ? email.trim() : "";
        if (findUserByIdentity(TYPE_EMAIL, normalizedEmail) != null) {
            throw new BizException(ResultCode.USER_ALREADY_EXISTS);
        }

        checkBetaCapacity();

        User user = new User();
        user.setStatus(CommonConstants.USER_STATUS_NORMAL);
        user.setRegisterSource("email");
        user.setLastLoginTime(LocalDateTime.now());

        userMapper.insert(user);
        paidInviteCodeService.consume(inviteCode, user.getId());
        createIdentityAuth(user.getId(), TYPE_EMAIL, normalizedEmail);
        createIdentityAuth(user.getId(), TYPE_OPEN_ID, "SKY" + IdUtil.fastSimpleUUID().toUpperCase());
        initProfile(user.getId());

        log.info("邮箱注册成功: userId={}", user.getId());
        return user;
    }

    // ===================== 手机号注册（新增） =====================

    @Override
    public void validatePhoneRegistration(String phone, String inviteCode) {
        if (findUserByIdentity(TYPE_PHONE, phone) != null) {
            throw new BizException(ResultCode.PHONE_ALREADY_REGISTERED, "该手机号已注册，请前往登录页登录");
        }

        checkBetaCapacity();
        paidInviteCodeService.validateAvailable(inviteCode);
    }

    @Override
    @Transactional
    public User registerByPhone(String phone, String inviteCode) {
        if (findUserByIdentity(TYPE_PHONE, phone) != null) {
            throw new BizException(ResultCode.PHONE_ALREADY_REGISTERED);
        }

        checkBetaCapacity();

        User user = new User();
        user.setStatus(CommonConstants.USER_STATUS_NORMAL);
        user.setRegisterSource("phone");
        user.setLastLoginTime(LocalDateTime.now());

        userMapper.insert(user);
        paidInviteCodeService.consume(inviteCode, user.getId());
        createIdentityAuth(user.getId(), TYPE_PHONE, phone);
        createIdentityAuth(user.getId(), TYPE_OPEN_ID, "SKY" + IdUtil.fastSimpleUUID().toUpperCase());
        initProfile(user.getId());

        log.info("手机号注册成功: userId={}", user.getId());
        return user;
    }

    // ===================== 绑定（新增） =====================

    @Override
    @Transactional
    public void bindIdentity(Long userId, String identityType, String identifier) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException(ResultCode.USER_NOT_FOUND);
        }

        if (user != null) {
            String normalized = identifier != null ? identifier.trim() : "";
            if (TYPE_EMAIL.equals(identityType)) {
                if (!EMAIL_PATTERN.matcher(normalized).matches()) {
                    throw new BizException(ResultCode.PARAM_ERROR.getCode(), "邮箱格式不正确");
                }
            } else if (TYPE_PHONE.equals(identityType)) {
                if (!CN_PHONE_PATTERN.matcher(normalized).matches()) {
                    throw new BizException(ResultCode.PARAM_ERROR.getCode(), "手机号格式不正确");
                }
            } else {
                throw new BizException(ResultCode.PARAM_ERROR.getCode(), "不支持的身份类型");
            }

            replaceIdentity(userId, identityType, normalized);
            log.info("身份绑定成功: userId={}, type={}", userId, identityType);
            if (TYPE_EMAIL.equals(identityType)) {
                triggerMatchSuccessEmailForUser(userId);
            }
            return;
        }

        UserAuth existingForOther = userAuthMapper.selectByIdentity(
                identityType, blindIndexService.hmacSha256Index(identifier));
        if (existingForOther != null && !existingForOther.getUserId().equals(userId)) {
            String label = TYPE_EMAIL.equals(identityType) ? "邮箱" : "手机号";
            throw new BizException(ResultCode.USER_ALREADY_EXISTS.getCode(),
                    "该" + label + "已被其他账号绑定");
        }

        UserAuth existingForSelf = userAuthMapper.selectByUserAndType(userId, identityType);
        if (existingForSelf != null) {
            String label = TYPE_EMAIL.equals(identityType) ? "邮箱" : "手机号";
            throw new BizException(ResultCode.DATA_ALREADY_EXISTS.getCode(),
                    "当前账号已绑定" + label);
        }

        createIdentityAuth(userId, identityType, identifier);
        log.info("身份绑定成功: userId={}, type={}", userId, identityType);
        if (TYPE_EMAIL.equals(identityType)) {
            triggerMatchSuccessEmailForUser(userId);
        }
    }

    @Override
    @Transactional
    public void requestAccountDeletion(Long userId, String reason) {
        User user = requireUser(userId);
        Integer status = user.getStatus();
        if (isStatus(status, CommonConstants.USER_STATUS_DELETED)) {
            throw new BizException(ResultCode.ACCOUNT_DELETED);
        }
        if (isStatus(status, CommonConstants.USER_STATUS_DISABLED)) {
            throw new BizException(ResultCode.ACCOUNT_DISABLED);
        }
        if (isStatus(status, CommonConstants.USER_STATUS_DELETION_PENDING)) {
            return;
        }

        userFeedbackService.submitAccountDeletionReason(userId, reason);
        userMapper.update(null, new LambdaUpdateWrapper<User>()
                .set(User::getStatus, CommonConstants.USER_STATUS_DELETION_PENDING)
                .set(User::getDeletionRequestedAt, LocalDateTime.now())
                .eq(User::getId, userId));
        log.info("账号进入注销冷静期: userId={}", userId);
    }

    @Override
    @Transactional(noRollbackFor = BizException.class)
    public void validateLoginAllowed(Long userId) {
        User user = requireUser(userId);
        validateLoginAllowed(user, LocalDateTime.now());
    }

    @Override
    @Transactional(noRollbackFor = BizException.class)
    public User completeLogin(Long userId) {
        User user = requireUser(userId);
        LocalDateTime now = LocalDateTime.now();
        validateLoginAllowed(user, now);

        if (isStatus(user.getStatus(), CommonConstants.USER_STATUS_DELETION_PENDING)) {
            userMapper.update(null, new LambdaUpdateWrapper<User>()
                    .set(User::getStatus, CommonConstants.USER_STATUS_NORMAL)
                    .set(User::getDeletionRequestedAt, null)
                    .set(User::getLastLoginTime, now)
                    .eq(User::getId, userId));
            log.info("账号登录后取消注销冷静期: userId={}", userId);
        } else {
            updateLastLoginTime(userId);
        }
        return requireUser(userId);
    }

    @Override
    @Transactional(noRollbackFor = BizException.class)
    public void validateActiveSession(Long userId) {
        User user = requireUser(userId);
        LocalDateTime now = LocalDateTime.now();
        if (isStatus(user.getStatus(), CommonConstants.USER_STATUS_DELETION_PENDING)
                && isDeletionGraceExpired(user, now)) {
            markAccountDeleted(user.getId());
        }
        if (isStatus(user.getStatus(), CommonConstants.USER_STATUS_DISABLED)) {
            throw new BizException(ResultCode.ACCOUNT_DISABLED);
        }
        if (!isStatus(user.getStatus(), CommonConstants.USER_STATUS_NORMAL)) {
            throw new BizException(ResultCode.ACCOUNT_DELETED);
        }
    }

    // ===================== 原有方法（保留） =====================

    @Override
    @Transactional
    public User createUser(String phone) {
        User user = new User();
        user.setStatus(CommonConstants.USER_STATUS_NORMAL);
        user.setRegisterSource("app");
        user.setLastLoginTime(LocalDateTime.now());

        userMapper.insert(user);
        createIdentityAuth(user.getId(), TYPE_PHONE, phone);
        createIdentityAuth(user.getId(), TYPE_OPEN_ID, "SKY" + IdUtil.fastSimpleUUID().toUpperCase());
        initProfile(user.getId());

        log.info("创建新用户: userId={}", user.getId());
        return user;
    }

    @Override
    @Transactional
    public User createUserByEmail(String email) {
        User user = new User();
        user.setStatus(CommonConstants.USER_STATUS_NORMAL);
        user.setRegisterSource("email");
        user.setLastLoginTime(LocalDateTime.now());

        userMapper.insert(user);
        createIdentityAuth(user.getId(), TYPE_EMAIL, email);
        createIdentityAuth(user.getId(), TYPE_OPEN_ID, "SKY" + IdUtil.fastSimpleUUID().toUpperCase());
        initProfile(user.getId());

        log.info("创建新用户(邮箱): userId={}", user.getId());
        return user;
    }

    @Override
    @Transactional
    public void updateUser(User user) {
        userMapper.updateById(user);
    }

    private void replaceIdentity(Long userId, String identityType, String identifier) {
        String identifierBidx = blindIndexService.hmacSha256Index(identifier);
        UserAuth taken = userAuthMapper.selectAnyByIdentity(identityType, identifierBidx);
        if (taken != null && !taken.getUserId().equals(userId)) {
            throw identityAlreadyBoundException(identityType);
        }

        UserAuth own = userAuthMapper.selectByUserAndType(userId, identityType);
        if (own != null) {
            if (identifier.equals(resolveIdentifier(own))) {
                return;
            }
            if (taken != null && !taken.getId().equals(own.getId()) && taken.getDeletedAt() != null) {
                userAuthMapper.hardDeleteDeletedById(taken.getId());
            }
            own.setIdentifier(identifier);
            prepareSensitiveFieldsForSave(own);
            try {
                userAuthMapper.updateSensitiveFields(own.getId(), own.getIdentifierEnc(), own.getIdentifierBidx());
            } catch (DuplicateKeyException e) {
                throw identityAlreadyBoundException(identityType);
            }
            return;
        }

        if (taken != null && taken.getUserId().equals(userId)) {
            taken.setIdentifier(identifier);
            prepareSensitiveFieldsForSave(taken);
            try {
                userAuthMapper.restoreSensitiveFields(taken.getId(), taken.getIdentifierEnc(), taken.getIdentifierBidx());
            } catch (DuplicateKeyException e) {
                throw identityAlreadyBoundException(identityType);
            }
            return;
        }

        createIdentityAuth(userId, identityType, identifier);
    }

    private static BizException identityAlreadyBoundException(String identityType) {
        String label = TYPE_EMAIL.equals(identityType) ? "邮箱" : "手机号";
        return new BizException(ResultCode.USER_ALREADY_EXISTS.getCode(),
                "该" + label + "已被其他账号绑定");
    }

    @Override
    @Transactional
    public void updateLastLoginTime(Long userId) {
        User user = new User();
        user.setId(userId);
        user.setLastLoginTime(LocalDateTime.now());
        userMapper.updateById(user);
    }

    @Override
    public UserDTO toDTO(User user) {
        if (user == null) return null;
        UserAuth emailAuth = userAuthMapper.selectByUserAndType(user.getId(), TYPE_EMAIL);
        UserAuth phoneAuth = userAuthMapper.selectByUserAndType(user.getId(), TYPE_PHONE);
        UserAuth openIdAuth = userAuthMapper.selectByUserAndType(user.getId(), TYPE_OPEN_ID);
        UserProfileDTO profile = getProfileQuietly(user.getId());

        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setPhone(resolveIdentifier(phoneAuth));
        dto.setEmail(resolveIdentifier(emailAuth));
        dto.setRegisterSource(user.getRegisterSource());
        dto.setOpenId(resolveIdentifier(openIdAuth));
        dto.setDisplayName(profile != null ? profile.getDisplayName() : null);
        dto.setRole(profile != null ? profile.getRole() : null);
        dto.setNickname(profile != null ? profile.getDisplayName() : null);
        dto.setAvatarUrl(null);
        dto.setGender(toLegacyGender(profile != null ? profile.getRole() : null));
        dto.setStatus(user.getStatus());
        dto.setDeletionRequestedAt(user.getDeletionRequestedAt());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setLastLoginTime(user.getLastLoginTime());
        return dto;
    }

    @Override
    public List<UserDTO> toDTOList(List<User> users) {
        if (users == null || users.isEmpty()) return Collections.emptyList();
        return users.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Override
    public java.util.Map<String, Object> getRegistrationCapacityStats() {
        long registeredCount = countBetaUsers();
        long remainingCount = Math.max(0, betaMaxUsers - registeredCount);
        java.util.Map<String, Object> stats = new java.util.HashMap<>();
        stats.put("maxUsers", betaMaxUsers);
        stats.put("registeredCount", registeredCount);
        stats.put("remainingCount", remainingCount);
        return stats;
    }

    // ===================== 内部工具方法 =====================

    private void checkBetaCapacity() {
        long currentUserCount = countBetaUsers();
        if (currentUserCount >= betaMaxUsers) {
            throw new BizException(ResultCode.BETA_FULL);
        }
    }

    private long countBetaUsers() {
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(User::getRegisterSource, "email", "phone")
               .eq(User::getStatus, CommonConstants.USER_STATUS_NORMAL);
        return userMapper.selectCount(wrapper);
    }

    private User findUserByIdentity(String identityType, String identifier) {
        UserAuth auth = userAuthMapper.selectByIdentity(identityType, blindIndexService.hmacSha256Index(identifier));
        if (auth == null) return null;
        return userMapper.selectById(auth.getUserId());
    }

    private User requireUser(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException(ResultCode.USER_NOT_FOUND);
        }
        return user;
    }

    private void validateLoginAllowed(User user, LocalDateTime now) {
        Integer status = user.getStatus();
        if (isStatus(status, CommonConstants.USER_STATUS_NORMAL)) {
            return;
        }
        if (isStatus(status, CommonConstants.USER_STATUS_DELETION_PENDING)) {
            if (isDeletionGraceExpired(user, now)) {
                markAccountDeleted(user.getId());
                throw new BizException(ResultCode.ACCOUNT_DELETED);
            }
            return;
        }
        if (isStatus(status, CommonConstants.USER_STATUS_DISABLED)) {
            throw new BizException(ResultCode.ACCOUNT_DISABLED);
        }
        throw new BizException(ResultCode.ACCOUNT_DELETED);
    }

    private boolean isStatus(Integer actual, int expected) {
        return actual != null && actual == expected;
    }

    private boolean isDeletionGraceExpired(User user, LocalDateTime now) {
        LocalDateTime requestedAt = user.getDeletionRequestedAt();
        if (requestedAt == null) {
            return true;
        }
        return !now.isBefore(requestedAt.plusDays(ACCOUNT_DELETION_GRACE_DAYS));
    }

    private void markAccountDeleted(Long userId) {
        User user = requireUser(userId);
        archiveAccountDeletion(user);
        int released = userAuthMapper.archiveLoginIdentitiesByUserId(userId);
        userMapper.update(null, new LambdaUpdateWrapper<User>()
                .set(User::getStatus, CommonConstants.USER_STATUS_DELETED)
                .eq(User::getId, userId));
        log.info("账号注销冷静期已过，已归档并释放登录标识: userId={}, releasedIdentities={}", userId, released);
    }

    private void archiveAccountDeletion(User user) {
        if (accountDeletionArchiveMapper.selectActiveByUserId(user.getId()) != null) {
            return;
        }

        UserAuth emailAuth = userAuthMapper.selectByUserAndType(user.getId(), TYPE_EMAIL);
        UserAuth phoneAuth = userAuthMapper.selectByUserAndType(user.getId(), TYPE_PHONE);

        AccountDeletionArchive archive = new AccountDeletionArchive();
        archive.setUserId(user.getId());
        archive.setDeletionRequestedAt(user.getDeletionRequestedAt());
        archive.setArchivedAt(LocalDateTime.now());
        archive.setArchiveReason(ACCOUNT_ARCHIVE_REASON_GRACE_EXPIRED);
        fillArchiveIdentity(archive, TYPE_EMAIL, resolveIdentifier(emailAuth));
        fillArchiveIdentity(archive, TYPE_PHONE, resolveIdentifier(phoneAuth));
        try {
            accountDeletionArchiveMapper.insert(archive);
        } catch (DuplicateKeyException e) {
            log.info("账号注销归档已存在，跳过重复写入: userId={}", user.getId());
        }
    }

    private void fillArchiveIdentity(AccountDeletionArchive archive, String identityType, String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return;
        }
        String normalized = identifier.trim();
        String encrypted = cryptoService.encrypt(normalized, archiveIdentityAad(archive.getUserId(), identityType));
        String blindIndex = blindIndexService.hmacSha256Index(normalized);
        if (TYPE_EMAIL.equals(identityType)) {
            archive.setEmailEnc(encrypted);
            archive.setEmailBidx(blindIndex);
        } else if (TYPE_PHONE.equals(identityType)) {
            archive.setPhoneEnc(encrypted);
            archive.setPhoneBidx(blindIndex);
        }
    }

    private void createIdentityAuth(Long userId, String identityType, String identifier) {
        if (identifier == null || identifier.isBlank()) return;
        String identifierBidx = blindIndexService.hmacSha256Index(identifier);
        UserAuth existing = userAuthMapper.selectAnyByIdentity(identityType, identifierBidx);
        if (existing != null) {
            throw new BizException(ResultCode.USER_ALREADY_EXISTS);
        }
        UserAuth auth = new UserAuth();
        auth.setUserId(userId);
        auth.setIdentityType(identityType);
        auth.setIdentifier(identifier);
        prepareSensitiveFieldsForSave(auth);
        try {
            userAuthMapper.insert(auth);
        } catch (DuplicateKeyException e) {
            throw new BizException(ResultCode.USER_ALREADY_EXISTS);
        }
    }

    private void prepareSensitiveFieldsForSave(UserAuth auth) {
        if (auth == null || auth.getUserId() == null || auth.getIdentityType() == null || auth.getIdentifier() == null
                || auth.getIdentifier().isBlank()) {
            return;
        }
        String identifier = auth.getIdentifier().trim();
        auth.setIdentifierEnc(cryptoService.encrypt(identifier, identifierAad(auth.getUserId(), auth.getIdentityType())));
        auth.setIdentifierBidx(blindIndexService.hmacSha256Index(identifier));
        auth.setIdentifier(null);
        auth.setCredential(null);
    }

    private String resolveIdentifier(UserAuth auth) {
        if (auth == null) {
            return null;
        }
        if (auth.getIdentifierEnc() != null && !auth.getIdentifierEnc().isBlank()) {
            return cryptoService.decrypt(auth.getIdentifierEnc(), identifierAad(auth.getUserId(), auth.getIdentityType()));
        }
        return auth.getIdentifier();
    }

    private String identifierAad(Long userId, String identityType) {
        return "skylia:skylia_user:user_auths:identifier:" + userId + ":" + identityType + ":1";
    }

    private String archiveIdentityAad(Long userId, String identityType) {
        return "skylia:skylia_user:account_deletion_archives:" + identityType + ":" + userId + ":1";
    }

    private void initProfile(Long userId) {
        try {
            PROFILE_INIT_EXECUTOR.submit(() -> {
                try {
                    Result<UserProfileDTO> result = profileFeignClient.initProfile(userId);
                    if (result == null || !result.isSuccess()) {
                        log.warn("Async profile init failed: userId={}, code={}, message={}",
                                userId,
                                result != null ? result.getCode() : null,
                                result != null ? result.getMessage() : null);
                    }
                } catch (Exception e) {
                    log.warn("Async profile init exception: userId={}, error={}", userId, e.getMessage());
                }
            });
        } catch (Exception e) {
            log.warn("Submit async profile init failed: userId={}, error={}", userId, e.getMessage());
        }
    }

    private UserProfileDTO getProfileQuietly(Long userId) {
        try {
            Result<UserProfileDTO> result = profileFeignClient.getProfile(userId);
            if (result == null) {
                log.error("查询用户资料失败: userId={}, error=empty profile service response", userId);
                throw new BizException(ResultCode.SERVICE_UNAVAILABLE, "画像服务暂不可用，无法确认用户资料状态");
            }
            if (result.isSuccess()) {
                return result.getData();
            }
            if (result.getCode() == ResultCode.DATA_NOT_FOUND.getCode()) {
                return null;
            }
            log.error("查询用户资料失败: userId={}, code={}, message={}",
                    userId, result.getCode(), result.getMessage());
            throw new BizException(ResultCode.SERVICE_UNAVAILABLE, "画像服务暂不可用，无法确认用户资料状态");
        } catch (BizException e) {
            throw e;
        } catch (Exception e) {
            log.error("查询用户资料异常: userId={}, error={}", userId, e.getMessage());
            throw new BizException(ResultCode.SERVICE_UNAVAILABLE, "画像服务暂不可用，无法确认用户资料状态");
        }
    }

    private Integer toLegacyGender(String role) {
        if ("lia".equalsIgnoreCase(role)) return 2;
        if ("sky".equalsIgnoreCase(role)) return 1;
        return null;
    }

    /** 绑定/更新邮箱后，为已匹配对象补发匹配成功邮件（失败不影响主流程）。 */
    private void triggerMatchSuccessEmailForUser(Long userId) {
        try {
            Result<Void> result = matchFeignClient.notifyMatchSuccessEmailForUser(userId);
            if (result == null || !result.isSuccess()) {
                log.warn("触发匹配成功邮件补发失败: userId={}, code={}, message={}",
                        userId,
                        result != null ? result.getCode() : null,
                        result != null ? result.getMessage() : null);
            }
        } catch (Exception e) {
            log.warn("触发匹配成功邮件补发异常: userId={}, error={}", userId, e.getMessage());
        }
    }
}
