package com.skylia.auth.controller;

import com.skylia.auth.dto.request.PhoneLoginRequest;
import com.skylia.auth.dto.request.PhoneRegisterRequest;
import com.skylia.auth.dto.request.PhoneSendCodeRequest;
import com.skylia.auth.dto.request.PhoneSendRegCodeRequest;
import com.skylia.auth.dto.request.WechatPhoneSendCodeRequest;
import com.skylia.auth.dto.request.WechatPhoneVerifyRequest;
import com.skylia.auth.dto.response.LoginResponse;
import com.skylia.auth.dto.response.WechatPhoneCodeResponse;
import com.skylia.auth.service.AuthService;
import com.skylia.auth.service.WechatPhoneAuthService;
import com.skylia.common.core.result.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "手机号认证接口")
@RestController
@RequestMapping("/api/v1/auth/phone")
@RequiredArgsConstructor
public class PhoneAuthController {

    private final AuthService authService;
    private final WechatPhoneAuthService wechatPhoneAuthService;

    @Operation(summary = "【登录专用】发送手机验证码 - 仅已注册手机号可收到")
    @PostMapping("/send-code")
    public Result<Void> sendCode(@Valid @RequestBody PhoneSendCodeRequest request) {
        authService.sendPhoneVerificationCode(request.getPhone());
        return Result.success(null, "验证码已发送");
    }

    @Operation(summary = "【注册专用】发送手机验证码")
    @PostMapping("/send-reg-code")
    public Result<Void> sendRegCode(@Valid @RequestBody PhoneSendRegCodeRequest request) {
        authService.sendPhoneRegistrationCode(request.getPhone(), request.getInviteCode());
        return Result.success(null, "验证码已发送");
    }

    @Operation(summary = "【登录专用】手机验证码登录")
    @PostMapping("/login")
    public Result<LoginResponse> login(@Valid @RequestBody PhoneLoginRequest request) {
        LoginResponse response = authService.loginByPhoneCode(request.getPhone(), request.getCode());
        return Result.success(response, "登录成功");
    }

    @Operation(summary = "【注册专用】手机号验证码注册")
    @PostMapping("/register")
    public Result<LoginResponse> register(@Valid @RequestBody PhoneRegisterRequest request) {
        LoginResponse response = authService.registerByPhoneCode(
                request.getPhone(), request.getCode(), request.getInviteCode());
        return Result.success(response, "注册成功");
    }

    @Operation(summary = "微信小程序授权手机号并自动发送验证码")
    @PostMapping("/wechat/send-code")
    public Result<WechatPhoneCodeResponse> sendWechatCode(
            @Valid @RequestBody WechatPhoneSendCodeRequest request) {
        return Result.success(
                wechatPhoneAuthService.sendVerificationCode(request.getCode(), request.getInviteCode()),
                "验证码已发送");
    }

    @Operation(summary = "校验微信授权手机号收到的短信验证码")
    @PostMapping("/wechat/verify")
    public Result<LoginResponse> verifyWechatCode(
            @Valid @RequestBody WechatPhoneVerifyRequest request) {
        return Result.success(wechatPhoneAuthService.verify(request.getTicket(), request.getCode()), "登录成功");
    }
}
