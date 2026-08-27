package com.skylia.auth.service;

import com.skylia.auth.dto.response.LoginResponse;
import com.skylia.auth.dto.response.WechatPhoneCodeResponse;
import com.skylia.common.core.exception.BizException;
import com.skylia.common.core.result.Result;
import com.skylia.common.core.result.ResultCode;
import com.skylia.common.redis.RedisService;
import com.skylia.user.api.UserFeignClient;
import com.skylia.user.api.dto.UserDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class WechatPhoneAuthService {

    private static final String TICKET_PREFIX = "auth:wechat-phone:ticket:";

    private final WechatMiniProgramPhoneClient phoneClient;
    private final UserFeignClient userFeignClient;
    private final AuthService authService;
    private final RedisService redisService;

    @Value("${skylia.wechat.mini-program.phone-ticket-minutes:10}")
    private int ticketMinutes;

    public WechatPhoneCodeResponse sendVerificationCode(String dynamicCode, String inviteCode) {
        String phone = phoneClient.exchangePhoneNumber(dynamicCode);
        Result<UserDTO> existing = userFeignClient.getByPhone(phone);
        boolean registered = existing != null && existing.isSuccess() && existing.getData() != null;
        String mode = registered ? "login" : "signup";
        if (registered) {
            authService.sendPhoneVerificationCode(phone);
        } else {
            authService.sendPhoneRegistrationCode(phone, inviteCode);
        }

        String ticket = UUID.randomUUID().toString().replace("-", "");
        redisService.set(TICKET_PREFIX + ticket, mode + "|" + phone + "|" + (inviteCode == null ? "" : inviteCode),
                Math.max(1, ticketMinutes), TimeUnit.MINUTES);
        return new WechatPhoneCodeResponse(ticket, phone, maskPhone(phone), mode);
    }

    public LoginResponse verify(String ticket, String code) {
        String value = redisService.get(TICKET_PREFIX + ticket);
        if (value == null || !value.matches("^(login|signup)\\|1[3-9]\\d{9}\\|.*$")) {
            throw new BizException(ResultCode.PARAM_ERROR.getCode(), "手机号授权已过期，请重新授权");
        }
        int separator = value.indexOf('|');
        String mode = value.substring(0, separator);
        int secondSeparator = value.indexOf('|', separator + 1);
        String phone = value.substring(separator + 1, secondSeparator);
        String inviteCode = value.substring(secondSeparator + 1);
        LoginResponse response = "login".equals(mode)
                ? authService.loginByPhoneCode(phone, code)
                : authService.registerByPhoneCode(phone, code, inviteCode);
        redisService.delete(TICKET_PREFIX + ticket);
        return response;
    }

    private String maskPhone(String phone) {
        return phone.substring(0, 3) + "****" + phone.substring(7);
    }
}
