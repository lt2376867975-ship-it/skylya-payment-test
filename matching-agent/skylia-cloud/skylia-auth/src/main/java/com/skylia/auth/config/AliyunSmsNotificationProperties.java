package com.skylia.auth.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 阿里云标准短信服务（Dysmsapi）通知模板配置。
 */
@Data
@Component
@ConfigurationProperties(prefix = "skylia.sms.notification")
public class AliyunSmsNotificationProperties {

    private boolean enabled = true;

    private String signName;

    private String matchSuccessTemplateCode;

    private String appointmentConfirmedTemplateCode;

    private String registrationVerificationTemplateCode;

    private String paidInviteCodeTemplateCode;

    private String matchCycleTimeoutTemplateCode;
}
