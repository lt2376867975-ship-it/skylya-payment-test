package com.skylia.auth.service.impl;

import com.skylia.auth.config.AliyunSmsNotificationProperties;
import com.skylia.auth.service.sms.NotificationSmsProvider;
import com.skylia.auth.service.sms.SmsDeliveryRecorder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.time.LocalDateTime;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationSmsServiceImplTest {

    @Mock
    private NotificationSmsProvider notificationSmsProvider;
    @Mock
    private SmsDeliveryRecorder smsDeliveryRecorder;

    private NotificationSmsServiceImpl service;

    @BeforeEach
    void setUp() {
        AliyunSmsNotificationProperties properties = new AliyunSmsNotificationProperties();
        properties.setMatchSuccessTemplateCode("SMS_MATCH");
        properties.setAppointmentConfirmedTemplateCode("SMS_APPOINTMENT");
        properties.setRegistrationVerificationTemplateCode("SMS_REGISTRATION_CODE");
        properties.setPaidInviteCodeTemplateCode("SMS_PAID_INVITE");
        service = new NotificationSmsServiceImpl(notificationSmsProvider, properties, smsDeliveryRecorder);
    }

    @Test
    void sendsMatchSuccessWithApprovedTemplateAndNoVariables() {
        service.sendMatchSuccess(101L, "13800000000", "match-1");

        verify(notificationSmsProvider).send(
                "13800000000", "SMS_MATCH", Map.of(), "match-1");
    }

    @Test
    void sendsAppointmentConfirmedWithTimeVariable() {
        service.sendAppointmentConfirmed(101L, "13800000000", "2026年7月20日 19:30", "appointment-1");

        verify(notificationSmsProvider).send(
                "13800000000",
                "SMS_APPOINTMENT",
                Map.of("time", "2026年7月20日 19:30"),
                "appointment-1");
    }

    @Test
    void sendsRegistrationVerificationWithCodeVariable() {
        service.sendRegistrationVerificationCode(
                "13800000000", "246810", "registration-1", LocalDateTime.now().plusMinutes(5));

        verify(notificationSmsProvider).send(
                "13800000000",
                "SMS_REGISTRATION_CODE",
                Map.of("code", "246810"),
                "registration-1");
    }

    @Test
    void sendsPaidInviteCodeWithCodeVariable() {
        service.sendPaidInviteCode("13800000000", "SKYTEST12345", "paid-invite-1");

        verify(notificationSmsProvider).send(
                "13800000000", "SMS_PAID_INVITE", Map.of("code", "SKYTEST12345"), "paid-invite-1");
    }

    @Test
    void acceptedEventIdIsNotSubmittedToProviderAgain() {
        when(smsDeliveryRecorder.wasAccepted("match-accepted-1")).thenReturn(true);

        service.sendMatchSuccess(101L, "13800000000", "match-accepted-1");

        verify(notificationSmsProvider, never()).send(any(), any(), any(), any());
    }
}
