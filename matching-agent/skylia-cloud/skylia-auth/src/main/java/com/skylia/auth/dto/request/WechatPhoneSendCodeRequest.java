package com.skylia.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

@Data
public class WechatPhoneSendCodeRequest {

    @NotBlank(message = "微信手机号授权凭证不能为空")
    private String code;

    @Pattern(regexp = "^$|^[A-Za-z0-9-]{8,32}$", message = "邀请码格式不正确")
    private String inviteCode;
}
