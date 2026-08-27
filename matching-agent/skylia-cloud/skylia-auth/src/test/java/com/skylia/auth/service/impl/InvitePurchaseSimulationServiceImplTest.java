package com.skylia.auth.service.impl;

import com.skylia.auth.config.AliyunSmsNotificationProperties;
import com.skylia.auth.dto.response.SimulateInvitePaymentResponse;
import com.skylia.auth.service.NotificationSmsService;
import com.skylia.common.core.exception.BizException;
import com.skylia.common.core.result.Result;
import com.skylia.common.redis.RedisService;
import com.skylia.user.api.UserFeignClient;
import com.skylia.user.api.dto.PaidInviteIssueRequest;
import com.skylia.user.api.dto.PaidInviteIssueResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InvitePurchaseSimulationServiceImplTest {

    @Mock
    private UserFeignClient userFeignClient;
    @Mock
    private NotificationSmsService notificationSmsService;
    @Mock
    private RedisService redisService;

    private InvitePurchaseSimulationServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new InvitePurchaseSimulationServiceImpl(
                userFeignClient,
                notificationSmsService,
                new AliyunSmsNotificationProperties(),
                redisService);
        ReflectionTestUtils.setField(service, "simulationEnabled", true);
    }

    @Test
    void issuesRealInviteAfterAtomicallyAcquiringCooldown() {
        LocalDateTime expiresAt = LocalDateTime.now().plusDays(30);
        when(redisService.setIfAbsent(anyString(), anyString(), eq(60L), eq(TimeUnit.SECONDS)))
                .thenReturn(true);
        when(userFeignClient.issuePaidInvite(any(PaidInviteIssueRequest.class)))
                .thenReturn(Result.success(PaidInviteIssueResponse.builder()
                        .id(88L)
                        .inviteCode("SKY23456789A")
                        .expiresAt(expiresAt)
                        .build()));

        SimulateInvitePaymentResponse response = service.simulate("13800000000");

        assertEquals("SKY23456789A", response.getInviteCode());
        assertEquals("138****0000", response.getPhoneMask());
        assertEquals("SIMULATED", response.getSmsStatus());
        ArgumentCaptor<PaidInviteIssueRequest> requestCaptor =
                ArgumentCaptor.forClass(PaidInviteIssueRequest.class);
        verify(userFeignClient).issuePaidInvite(requestCaptor.capture());
        assertEquals("13800000000", requestCaptor.getValue().getPhone());
        assertTrue(requestCaptor.getValue().getPaymentReference().startsWith("SIM-"));
        verify(notificationSmsService, never()).sendPaidInviteCode(
                anyString(), anyString(), anyString());
    }

    @Test
    void rejectsConcurrentSimulationBeforeIssuingAnotherInvite() {
        when(redisService.setIfAbsent(anyString(), anyString(), eq(60L), eq(TimeUnit.SECONDS)))
                .thenReturn(false);

        BizException exception = assertThrows(BizException.class,
                () -> service.simulate("13800000000"));

        assertEquals("请稍后再模拟付款", exception.getMessage());
        verify(userFeignClient, never()).issuePaidInvite(any(PaidInviteIssueRequest.class));
    }
}
