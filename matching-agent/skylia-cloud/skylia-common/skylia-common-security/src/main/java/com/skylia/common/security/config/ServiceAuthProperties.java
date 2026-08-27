package com.skylia.common.security.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 服务侧鉴权配置。
 * 用于防止客户端绕过网关，直接访问微服务端口时伪造用户头。
 */
@Data
@Component
@ConfigurationProperties(prefix = "skylia.security")
public class ServiceAuthProperties {

    /**
     * 是否启用服务侧 JWT 校验。
     */
    private boolean enabled = true;

    /**
     * 内部服务签名。密钥只从环境变量读取；未配置时内部接口 fail-close。
     */
    private InternalSignature internalSignature = new InternalSignature();

    /**
     * 放行路径（Ant 风格），默认覆盖公开接口与内部微服务接口。
     */
    private List<String> whitelist = new ArrayList<>(List.of(
            "/actuator/**",
            "/doc.html",
            "/swagger-resources/**",
            "/v3/api-docs/**",
            "/webjars/**",
            // 邮箱认证
            "/api/v1/auth/send-code",
            "/api/v1/auth/send-reg-code",
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh",
            // 手机号认证
            "/api/v1/auth/phone/send-code",
            "/api/v1/auth/phone/send-reg-code",
            "/api/v1/auth/phone/login",
            "/api/v1/auth/phone/register",
            "/api/v1/auth/phone/wechat/send-code",
            "/api/v1/auth/phone/wechat/verify",
            "/api/v1/auth/invite-codes/simulate-payment",
            "/api/v1/admin/auth/login",
            // Skylia Type 测试站匿名上报（无用户 Token）
            "/api/v1/public/skylia-type-test/**",
            // 官网微信分享 JS-SDK 签名
            "/api/v1/public/wechat/**"
    ));

    @Data
    public static class InternalSignature {
        private boolean enabled = true;
        /**
         * 仅用于无中断滚动升级。false 时只兼容完全没有签名头的旧服务；
         * 任何带签名头的请求仍必须通过完整校验。生产收口后必须为 true。
         */
        private boolean enforce = true;
        private String secret = "";
        private long maxClockSkewSeconds = 300;
        private List<String> allowedServices = new ArrayList<>(List.of(
                "skylia-gateway",
                "skylia-auth",
                "skylia-user",
                "skylia-profile",
                "skylia-chat",
                "skylia-match",
                "skylia-file",
                "skylia-ai"
        ));
    }
}
