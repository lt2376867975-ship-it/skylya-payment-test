package com.skylia.user.api;

import com.skylia.common.core.result.Result;
import com.skylia.user.api.dto.BindIdentityRequest;
import com.skylia.user.api.dto.AccountDeletionRequest;
import com.skylia.user.api.dto.EmailRegistrationRequest;
import com.skylia.user.api.dto.PhoneRegistrationRequest;
import com.skylia.user.api.dto.SmsDeliveryRecordCreateRequest;
import com.skylia.user.api.dto.SmsDeliveryReceiptUpdateRequest;
import com.skylia.user.api.dto.SmsVerificationUsedRequest;
import com.skylia.user.api.dto.UserDTO;
import com.skylia.user.api.dto.UserFeedbackPageDTO;
import com.skylia.user.api.dto.PaidInviteIssueRequest;
import com.skylia.user.api.dto.PaidInviteIssueResponse;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@FeignClient(name = "skylia-user", url = "${feign.client.config.skylia-user.url:http://127.0.0.1:8082}", path = "/api/v1/internal/users")
public interface UserFeignClient {

    /** 须置于 /{userId} 之前，避免部分契约实现将路径段误解析为路径变量 */
    @GetMapping("/feedback")
    Result<UserFeedbackPageDTO> feedbackPage(
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "userId", required = false) Long userId,
            @RequestParam(value = "nickname", required = false) String nickname);

    @GetMapping("/batch")
    Result<List<UserDTO>> getByIds(@RequestParam("ids") List<Long> ids);

    @GetMapping("/{userId}")
    Result<UserDTO> getById(@PathVariable("userId") Long userId);

    @PostMapping("/{userId}/touch-login")
    Result<Void> touchLogin(@PathVariable("userId") Long userId);

    @PostMapping("/{userId}/request-deletion")
    Result<Void> requestAccountDeletion(
            @PathVariable("userId") Long userId,
            @RequestBody(required = false) AccountDeletionRequest request);

    @PostMapping("/{userId}/validate-login-allowed")
    Result<Void> validateLoginAllowed(@PathVariable("userId") Long userId);

    @PostMapping("/{userId}/complete-login")
    Result<UserDTO> completeLogin(@PathVariable("userId") Long userId);

    @PostMapping("/{userId}/validate-active-session")
    Result<Void> validateActiveSession(@PathVariable("userId") Long userId);

    // ===================== 邮箱 =====================

    @GetMapping("/email/{email}")
    Result<UserDTO> getByEmail(@PathVariable("email") String email);

    @PostMapping("/email/{email}")
    Result<UserDTO> getOrCreateByEmail(@PathVariable("email") String email);

    @PostMapping("/register-by-email")
    Result<UserDTO> registerByEmail(@RequestBody EmailRegistrationRequest request);

    @PostMapping("/validate-email-registration")
    Result<Void> validateEmailRegistration(@RequestBody EmailRegistrationRequest request);

    // ===================== 手机号 =====================

    @GetMapping("/phone/{phone}")
    Result<UserDTO> getByPhone(@PathVariable("phone") String phone);

    @PostMapping("/phone/{phone}")
    Result<UserDTO> getOrCreateByPhone(@PathVariable("phone") String phone);

    @PostMapping("/register-by-phone")
    Result<UserDTO> registerByPhone(@RequestBody PhoneRegistrationRequest request);

    @PostMapping("/validate-phone-registration")
    Result<Void> validatePhoneRegistration(@RequestBody PhoneRegistrationRequest request);

    @PostMapping("/paid-invite-codes/issue")
    Result<PaidInviteIssueResponse> issuePaidInvite(@RequestBody PaidInviteIssueRequest request);

    // ===================== 绑定 =====================

    @PostMapping("/{userId}/bind-identity")
    Result<Void> bindIdentity(@PathVariable("userId") Long userId,
                              @RequestParam("type") String identityType,
                              @RequestParam("identifier") String identifier);

    /** 管理后台注册名额统计。 */
    @GetMapping("/stats/registration-capacity")
    Result<Map<String, Object>> getRegistrationCapacityStats();

    /** auth 服务写入短信提交结果；只保存脱敏/加密后的运营台账，不保存验证码或模板变量。 */
    @PostMapping("/sms-delivery-records")
    Result<Void> createSmsDeliveryRecord(@RequestBody SmsDeliveryRecordCreateRequest request);

    /** 同一 eventId 已有阿里云受理记录时，auth 重试不得再次提交短信。 */
    @GetMapping("/sms-delivery-records/accepted")
    Result<Boolean> hasAcceptedSmsDeliveryEvent(@RequestParam("eventId") String eventId);

    /** 验证码校验成功后，按手机号和场景标记最近一条有效记录已使用。 */
    @PostMapping("/sms-delivery-records/verification-used")
    Result<Boolean> markSmsVerificationUsed(@RequestBody SmsVerificationUsedRequest request);

    /** auth 服务消费阿里云 MNS 回执后，按 bizId 回填最终送达状态。 */
    @PostMapping("/sms-delivery-records/receipt")
    Result<Boolean> updateSmsDeliveryReceipt(@RequestBody SmsDeliveryReceiptUpdateRequest request);
}
