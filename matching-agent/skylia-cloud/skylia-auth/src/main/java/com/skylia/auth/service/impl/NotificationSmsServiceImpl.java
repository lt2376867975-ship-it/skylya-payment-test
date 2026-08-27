package com.skylia.auth.service.impl;

import com.skylia.auth.config.AliyunSmsNotificationProperties;
import com.skylia.auth.service.NotificationSmsService;
import com.skylia.auth.service.sms.NotificationSmsProvider;
import com.skylia.auth.service.sms.SmsDeliveryRecorder;
import com.skylia.auth.service.sms.SmsProviderSendResult;
import com.skylia.common.core.exception.BizException;
import com.skylia.common.core.result.ResultCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Map;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class NotificationSmsServiceImpl implements NotificationSmsService {

    private final NotificationSmsProvider notificationSmsProvider;
    private final AliyunSmsNotificationProperties properties;
    private final SmsDeliveryRecorder smsDeliveryRecorder;

    @Override
    public void sendMatchSuccess(Long userId, String phone, String eventId) {
        sendTracked(userId, phone, "MATCH_SUCCESS", properties.getMatchSuccessTemplateCode(),
                Map.of(), eventId, null);
    }

    @Override
    public void sendAppointmentConfirmed(Long userId, String phone, String confirmedTimeText, String eventId) {
        if (!StringUtils.hasText(confirmedTimeText)) {
            throw new BizException(ResultCode.PARAM_ERROR.getCode(), "预约确认时间不能为空");
        }
        sendTracked(userId, phone, "APPOINTMENT_CONFIRMED", properties.getAppointmentConfirmedTemplateCode(),
                Map.of("time", confirmedTimeText.trim()), eventId, null);
    }

    @Override
    public void sendMatchCycleTimeout(Long userId, String phone, String eventId) {
        sendTracked(userId, phone, "MATCH_CYCLE_TIMEOUT", properties.getMatchCycleTimeoutTemplateCode(),
                Map.of(), eventId, null);
    }

    @Override
    public void sendRegistrationVerificationCode(
            String phone, String code, String eventId, LocalDateTime codeExpiresAt) {
        if (!StringUtils.hasText(code)) {
            throw new BizException(ResultCode.PARAM_ERROR.getCode(), "注册验证码不能为空");
        }
        sendTracked(null, phone, "REGISTRATION_VERIFICATION", properties.getRegistrationVerificationTemplateCode(),
                Map.of("code", code.trim()), eventId, codeExpiresAt);
    }

    @Override
    public void sendPaidInviteCode(String phone, String inviteCode, String eventId) {
        if (!StringUtils.hasText(inviteCode)) {
            throw new BizException(ResultCode.PARAM_ERROR.getCode(), "邀请码不能为空");
        }
        sendTracked(null, phone, "PAID_INVITE_CODE", properties.getPaidInviteCodeTemplateCode(),
                Map.of("code", inviteCode.trim()), eventId, null);
    }

    private void sendTracked(
            Long userId,
            String phone,
            String scene,
            String templateCode,
            Map<String, String> templateParams,
            String eventId,
            LocalDateTime codeExpiresAt) {
        if (smsDeliveryRecorder.wasAccepted(eventId)) {
            return;
        }
        LocalDateTime requestedAt = LocalDateTime.now();
        try {
            SmsProviderSendResult result = notificationSmsProvider.send(
                    phone, templateCode, templateParams, eventId);
            smsDeliveryRecorder.accepted(
                    eventId, userId, phone, scene, templateCode, requestedAt, codeExpiresAt, result);
        } catch (RuntimeException e) {
            smsDeliveryRecorder.failed(eventId, userId, phone, scene, templateCode, requestedAt, e);
            throw e;
        }
    }
}
