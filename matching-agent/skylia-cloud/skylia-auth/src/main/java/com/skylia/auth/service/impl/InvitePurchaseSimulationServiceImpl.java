package com.skylia.auth.service.impl;

import com.skylia.auth.config.AliyunSmsNotificationProperties;
import com.skylia.auth.dto.response.SimulateInvitePaymentResponse;
import com.skylia.auth.service.InvitePurchaseSimulationService;
import com.skylia.auth.service.NotificationSmsService;
import com.skylia.common.core.exception.BizException;
import com.skylia.common.core.result.Result;
import com.skylia.common.core.result.ResultCode;
import com.skylia.common.redis.RedisService;
import com.skylia.user.api.UserFeignClient;
import com.skylia.user.api.dto.PaidInviteIssueRequest;
import com.skylia.user.api.dto.PaidInviteIssueResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
public class InvitePurchaseSimulationServiceImpl implements InvitePurchaseSimulationService {

    private final UserFeignClient userFeignClient;
    private final NotificationSmsService notificationSmsService;
    private final AliyunSmsNotificationProperties smsProperties;
    private final RedisService redisService;

    @Value("${skylia.invite.purchase-simulation-enabled:false}")
    private boolean simulationEnabled;

    @Override
    public SimulateInvitePaymentResponse simulate(String phone) {
        if (!simulationEnabled) throw new BizException(ResultCode.INVITE_SIMULATION_DISABLED);

        String cooldownKey = "invite:payment-simulation:" + sha256(phone);
        if (!Boolean.TRUE.equals(redisService.setIfAbsent(cooldownKey, "1", 60, TimeUnit.SECONDS))) {
            throw new BizException(ResultCode.SEND_CODE_TOO_FREQUENT.getCode(), "请稍后再模拟付款");
        }

        String paymentReference = "SIM-" + UUID.randomUUID();
        Result<PaidInviteIssueResponse> result = userFeignClient.issuePaidInvite(
                PaidInviteIssueRequest.builder().phone(phone).paymentReference(paymentReference).build());
        if (result == null || !result.isSuccess() || result.getData() == null) {
            throw new BizException(result == null ? ResultCode.SERVICE_UNAVAILABLE.getCode() : result.getCode(),
                    result == null ? "邀请码服务暂时不可用" : result.getMessage());
        }

        PaidInviteIssueResponse issued = result.getData();
        String smsStatus = "SIMULATED";
        String message = "邀请码已生成；当前短信模板未配置，页面已模拟展示短信内容";
        if (StringUtils.hasText(smsProperties.getPaidInviteCodeTemplateCode())) {
            try {
                notificationSmsService.sendPaidInviteCode(
                        phone, issued.getInviteCode(), "paid-invite-" + issued.getId());
                smsStatus = "ACCEPTED";
                message = "邀请码短信已提交发送";
            } catch (RuntimeException ignored) {
                message = "邀请码已生成；短信提交失败，页面已保留本次模拟结果";
            }
        }
        return SimulateInvitePaymentResponse.builder()
                .inviteCode(issued.getInviteCode())
                .phoneMask(maskPhone(phone))
                .smsStatus(smsStatus)
                .message(message)
                .expiresAt(issued.getExpiresAt())
                .build();
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("无法生成限流键", e);
        }
    }

    private String maskPhone(String phone) {
        return phone.substring(0, 3) + "****" + phone.substring(7);
    }
}
