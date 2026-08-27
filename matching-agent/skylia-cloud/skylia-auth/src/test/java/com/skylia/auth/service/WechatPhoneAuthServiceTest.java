package com.skylia.auth.service;

import com.skylia.auth.dto.response.LoginResponse;
import com.skylia.auth.dto.response.WechatPhoneCodeResponse;
import com.skylia.common.core.result.Result;
import com.skylia.common.redis.RedisService;
import com.skylia.user.api.UserFeignClient;
import com.skylia.user.api.dto.UserDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class WechatPhoneAuthServiceTest {

    private final WechatMiniProgramPhoneClient phoneClient = mock(WechatMiniProgramPhoneClient.class);
    private final UserFeignClient userFeignClient = mock(UserFeignClient.class);
    private final AuthService authService = mock(AuthService.class);
    private final RedisService redisService = mock(RedisService.class);
    private final WechatPhoneAuthService service = new WechatPhoneAuthService(
            phoneClient, userFeignClient, authService, redisService);

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "ticketMinutes", 10);
    }

    @Test
    void authorizedExistingPhoneReturnsPhoneAndSendsLoginCode() {
        String phone = "13812345678";
        UserDTO user = new UserDTO();
        user.setId(9L);
        when(phoneClient.exchangePhoneNumber("dynamic-code")).thenReturn(phone);
        when(userFeignClient.getByPhone(phone)).thenReturn(Result.success(user));

        WechatPhoneCodeResponse response = service.sendVerificationCode("dynamic-code", null);

        assertEquals("login", response.mode());
        assertEquals(phone, response.phone());
        assertEquals("138****5678", response.maskedPhone());
        assertFalse(response.ticket().contains(phone));
        verify(authService).sendPhoneVerificationCode(phone);
        verify(redisService).set(anyString(), eq("login|" + phone + "|"), eq(10L), eq(TimeUnit.MINUTES));
    }

    @Test
    void ticketVerificationUsesServerSidePhoneAndDeletesTicketAfterSuccess() {
        String ticket = "opaque-ticket";
        LoginResponse expected = LoginResponse.builder().accessToken("token").build();
        when(redisService.get("auth:wechat-phone:ticket:" + ticket))
                .thenReturn("signup|13912345678|SKYTEST12345");
        when(authService.registerByPhoneCode("13912345678", "123456", "SKYTEST12345"))
                .thenReturn(expected);

        LoginResponse actual = service.verify(ticket, "123456");

        assertEquals(expected, actual);
        verify(redisService).delete("auth:wechat-phone:ticket:" + ticket);
    }
}
