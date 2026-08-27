package com.skylia.common.core.result;

import lombok.Getter;

/**
 * 统一状态码枚举
 */
@Getter
public enum ResultCode {

    // ========== 通用状态码 ==========
    SUCCESS(200, "操作成功"),
    FAIL(500, "操作失败"),

    // ========== 认证相关 1xxx ==========
    UNAUTHORIZED(1001, "未登录或登录已过期"),
    TOKEN_INVALID(1002, "Token无效"),
    TOKEN_EXPIRED(1003, "Token已过期"),
    ACCESS_DENIED(1004, "权限不足"),
    ACCOUNT_DISABLED(1005, "账号已禁用"),
    ACCOUNT_LOCKED(1006, "账号已锁定"),
    ACCOUNT_DELETED(1007, "账号已注销，无法登录"),

    // ========== 参数相关 2xxx ==========
    PARAM_ERROR(2001, "参数错误"),
    PARAM_MISSING(2002, "参数缺失"),
    PARAM_TYPE_ERROR(2003, "参数类型错误"),
    PARAM_VALIDATION_FAILED(2004, "参数校验失败"),

    // ========== 用户相关 3xxx ==========
    USER_NOT_FOUND(3001, "用户不存在"),
    USER_DISABLED(3002, "用户已禁用"),
    USER_ALREADY_EXISTS(3003, "用户已存在"),
    PHONE_ALREADY_REGISTERED(3004, "手机号已注册"),
    VERIFICATION_CODE_ERROR(3005, "验证码错误"),
    VERIFICATION_CODE_EXPIRED(3006, "验证码已过期"),
    SEND_CODE_TOO_FREQUENT(3007, "发送验证码太频繁"),
    PASSWORD_ERROR(3008, "密码错误"),
    BETA_FULL(3013, "内测名额已满"),
    INVITE_CODE_INVALID(3014, "邀请码无效或已过期"),
    INVITE_CODE_USED(3015, "邀请码已被使用"),
    INVITE_SIMULATION_DISABLED(3016, "模拟付款功能未开启"),
    /** 登录发码：邮箱尚未在系统注册 */
    EMAIL_NOT_REGISTERED_FOR_LOGIN(3012, "该邮箱尚未注册，请先完成注册"),

    // ========== 匹配相关 4xxx ==========
    MATCH_NOT_FOUND(4001, "匹配记录不存在"),
    ALREADY_MATCHED(4002, "已经配对"),
    MATCH_EXPIRED(4003, "匹配已过期"),
    DAILY_MATCH_LIMIT(4004, "今日匹配次数已用完"),
    CANNOT_MATCH_SELF(4005, "不能与自己匹配"),
    MATCH_REJECTED(4006, "对方已拒绝"),

    // ========== 聊天相关 5xxx ==========
    CONVERSATION_NOT_FOUND(5001, "会话不存在"),
    MESSAGE_SEND_FAILED(5002, "消息发送失败"),
    NOT_IN_CONVERSATION(5003, "不在该会话中"),
    MESSAGE_RECALL_TIMEOUT(5004, "消息撤回已超时"),
    CHAT_NOT_AVAILABLE(5005, "聊天功能暂不可用"),

    // ========== 文件相关 6xxx ==========
    FILE_NOT_FOUND(6001, "文件不存在"),
    FILE_UPLOAD_FAILED(6002, "文件上传失败"),
    FILE_TYPE_NOT_ALLOWED(6003, "文件类型不允许"),
    FILE_SIZE_EXCEEDED(6004, "文件大小超限"),

    // ========== 系统相关 9xxx ==========
    SYSTEM_ERROR(9001, "系统异常"),
    SERVICE_UNAVAILABLE(9002, "服务不可用"),
    RATE_LIMIT_EXCEEDED(9003, "请求太频繁"),
    DATA_NOT_FOUND(9004, "数据不存在"),
    DATA_ALREADY_EXISTS(9005, "数据已存在"),
    OPERATION_NOT_ALLOWED(9006, "操作不允许"),
    THIRD_PARTY_ERROR(9007, "第三方服务异常"),
    PERMISSION_DENIED(9008, "已删除");

    /**
     * 状态码
     */
    private final int code;

    /**
     * 消息
     */
    private final String message;

    ResultCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}



