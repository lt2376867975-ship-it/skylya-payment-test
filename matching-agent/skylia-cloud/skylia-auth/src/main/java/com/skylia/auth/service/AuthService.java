package com.skylia.auth.service;

import com.skylia.auth.dto.response.LoginResponse;

/**
 * 认证服务接口 —— 支持邮箱 + 手机号双通道。
 */
public interface AuthService {

    // ===================== 邮箱通道（保留原有） =====================

    void sendVerificationCode(String email);

    void sendRegistrationCode(String email, String inviteCode);

    LoginResponse loginByCode(String email, String code);

    LoginResponse registerByCode(String email, String code, String inviteCode);

    // ===================== 手机号通道（新增） =====================

    void sendPhoneVerificationCode(String phone);

    void sendPhoneRegistrationCode(String phone, String inviteCode);

    LoginResponse loginByPhoneCode(String phone, String code);

    LoginResponse registerByPhoneCode(String phone, String code, String inviteCode);

    // ===================== Token 管理 =====================

    LoginResponse refreshToken(String refreshToken);

    void logout(String token);
}
