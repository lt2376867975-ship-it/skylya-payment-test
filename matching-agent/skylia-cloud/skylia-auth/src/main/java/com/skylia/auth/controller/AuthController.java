package com.skylia.auth.controller;

import com.skylia.auth.dto.request.LoginRequest;
import com.skylia.auth.dto.request.RegisterRequest;
import com.skylia.auth.dto.request.SendCodeRequest;
import com.skylia.auth.dto.request.SendRegCodeRequest;
import com.skylia.auth.dto.response.LoginResponse;
import com.skylia.auth.service.AuthService;
import com.skylia.common.core.result.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * 认证控制器
 */
@Tag(name = "认证接口")
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "【登录专用】发送邮箱验证码 - 仅已注册邮箱可收到")
    @PostMapping("/send-code")
    public Result<Void> sendCode(@Valid @RequestBody SendCodeRequest request) {
        authService.sendVerificationCode(request.getEmail());
        return Result.success(null, "验证码已发送");
    }

    @Operation(summary = "【注册专用】发送邮箱验证码")
    @PostMapping("/send-reg-code")
    public Result<Void> sendRegCode(@Valid @RequestBody SendRegCodeRequest request) {
        authService.sendRegistrationCode(request.getEmail(), request.getInviteCode());
        return Result.success(null, "验证码已发送");
    }

    @Operation(summary = "【登录专用】邮箱验证码登录 - 仅已注册用户可登录")
    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.loginByCode(
                request.getEmail(), request.getCode());
        return Result.success(response, "登录成功");
    }

    @Operation(summary = "【注册专用】邮箱验证码注册")
    @PostMapping("/register")
    public Result<LoginResponse> register(@Valid @RequestBody RegisterRequest request) {
        LoginResponse response = authService.registerByCode(
                request.getEmail(), request.getCode(), request.getInviteCode());
        return Result.success(response, "注册成功");
    }

    @Operation(summary = "刷新令牌")
    @PostMapping("/refresh")
    public Result<LoginResponse> refreshToken(
            @Parameter(description = "刷新令牌")
            @RequestHeader("X-Refresh-Token") String refreshToken) {
        LoginResponse response = authService.refreshToken(refreshToken);
        return Result.success(response);
    }

    @Operation(summary = "退出登录")
    @PostMapping("/logout")
    public Result<Void> logout(
            @Parameter(description = "访问令牌")
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring(7);
            authService.logout(token);
        }
        return Result.success(null, "已退出登录");
    }
}
