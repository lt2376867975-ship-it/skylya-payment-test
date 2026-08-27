package com.skylia.auth.service.impl;

import com.skylia.auth.service.EmailService;
import com.skylia.auth.service.PhoneRegistrationCodeService;
import com.skylia.auth.service.SmsService;
import com.skylia.common.core.result.Result;
import com.skylia.common.redis.RedisService;
import com.skylia.user.api.UserFeignClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplPhoneRegistrationTest {

    @Mock private RedisService redisService;
    @Mock private UserFeignClient userFeignClient;
    @Mock private EmailService emailService;
    @Mock private SmsService smsService;
    @Mock private PhoneRegistrationCodeService phoneRegistrationCodeService;

    @InjectMocks
    private AuthServiceImpl service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "sendIntervalSeconds", 60);
    }

    @Test
    void registrationSendUsesStandardTemplateCodeServiceInsteadOfPnvs() {
        String phone = "13800000000";
        when(redisService.hasKey("phone:limit:" + phone)).thenReturn(false);
        when(userFeignClient.getByPhone(phone)).thenReturn(Result.success());
        when(userFeignClient.validatePhoneRegistration(any())).thenReturn(Result.success());

        service.sendPhoneRegistrationCode(phone, "SKYTEST12345");

        verify(phoneRegistrationCodeService).send(phone);
        verifyNoInteractions(smsService);
    }
}
