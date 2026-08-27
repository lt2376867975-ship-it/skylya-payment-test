package com.skylia.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
@Schema(description = "手机号注册 - 发送验证码请求")
public class PhoneSendRegCodeRequest {

    @Schema(description = "手机号", example = "13800138000")
    @NotBlank(message = "手机号不能为空")
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;

    @Schema(description = "付费邀请码", example = "SKY8K2M4P7Q9")
    @NotBlank(message = "邀请码不能为空")
    @Pattern(regexp = "^[A-Za-z0-9-]{8,32}$", message = "邀请码格式不正确")
    private String inviteCode;
}
