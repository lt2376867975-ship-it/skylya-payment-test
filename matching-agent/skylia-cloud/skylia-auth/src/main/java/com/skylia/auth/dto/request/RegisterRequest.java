package com.skylia.auth.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * 注册请求
 */
@Data
@Schema(description = "邮箱验证码注册请求")
public class RegisterRequest {

    @Schema(description = "邮箱", example = "user@example.com")
    @NotBlank(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    private String email;

    @Schema(description = "验证码", example = "123456")
    @NotBlank(message = "验证码不能为空")
    @Pattern(regexp = "^\\d{6}$", message = "验证码格式不正确")
    private String code;

    @Schema(description = "付费邀请码", example = "SKY8K2M4P7Q9")
    @NotBlank(message = "邀请码不能为空")
    @Pattern(regexp = "^[A-Za-z0-9-]{8,32}$", message = "邀请码格式不正确")
    private String inviteCode;
}
