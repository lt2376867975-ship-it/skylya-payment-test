package com.skylia.user.controller;

import com.skylia.common.core.constant.CommonConstants;
import com.skylia.common.core.result.Result;
import com.skylia.user.api.dto.EmailRegistrationRequest;
import com.skylia.user.api.dto.AccountDeletionRequest;
import com.skylia.user.api.dto.PhoneRegistrationRequest;
import com.skylia.user.api.dto.PaidInviteIssueRequest;
import com.skylia.user.api.dto.PaidInviteIssueResponse;
import com.skylia.user.api.dto.SmsDeliveryRecordCreateRequest;
import com.skylia.user.api.dto.SmsDeliveryReceiptUpdateRequest;
import com.skylia.user.api.dto.SmsVerificationUsedRequest;
import com.skylia.user.api.dto.UserDTO;
import com.skylia.user.api.dto.UserFeedbackPageDTO;
import com.skylia.user.domain.entity.User;
import com.skylia.user.service.UserFeedbackService;
import com.skylia.user.service.AdminUserOwnedDataCleanupService;
import com.skylia.user.service.SmsDeliveryRecordService;
import com.skylia.user.service.UserService;
import io.swagger.v3.oas.annotations.Hidden;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Hidden
@RestController
@RequestMapping("/api/v1/internal/users")
@RequiredArgsConstructor
public class InternalUserController {

    private final UserService userService;
    private final UserFeedbackService userFeedbackService;
    private final SmsDeliveryRecordService smsDeliveryRecordService;
    private final AdminUserOwnedDataCleanupService adminUserOwnedDataCleanupService;
    private final com.skylia.user.service.PaidInviteCodeService paidInviteCodeService;

    @GetMapping(value = "/admin/user-data/preflight", headers = CommonConstants.HEADER_SOURCE + "=service")
    public Result<Map<String, Object>> preflightUserDataCleanup(
            @RequestParam(required = false) Long userId) {
        return Result.success(adminUserOwnedDataCleanupService.preflight(userId));
    }

    @DeleteMapping(value = "/admin/user-data/all", headers = CommonConstants.HEADER_SOURCE + "=service")
    public Result<Map<String, Object>> deleteAllOwnedUserData() {
        return Result.success(adminUserOwnedDataCleanupService.deleteAllUserData());
    }

    @DeleteMapping(value = "/admin/user-data/{userId}", headers = CommonConstants.HEADER_SOURCE + "=service")
    public Result<Map<String, Object>> deleteOwnedUserData(@PathVariable Long userId) {
        return Result.success(adminUserOwnedDataCleanupService.deleteUserData(userId));
    }

    /**
     * 固定路径须先于 /{userId}；且 userId 仅匹配数字，避免部分 Spring 版本将 “feedback” 等字面量误匹配到 /{userId} 引发转换异常→系统异常。
     */
    @GetMapping("/feedback")
    public Result<UserFeedbackPageDTO> feedbackPage(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String nickname) {
        return Result.success(userFeedbackService.adminPage(page, size, category, userId, nickname));
    }

    @PostMapping("/{userId:\\d+}/touch-login")
    public Result<Void> touchLogin(@PathVariable("userId") Long userId) {
        userService.updateLastLoginTime(userId);
        return Result.success(null);
    }

    @PostMapping("/{userId:\\d+}/request-deletion")
    public Result<Void> requestAccountDeletion(
            @PathVariable("userId") Long userId,
            @RequestBody(required = false) AccountDeletionRequest request) {
        userService.requestAccountDeletion(userId, request == null ? null : request.getReason());
        return Result.success(null);
    }

    @PostMapping("/{userId:\\d+}/validate-login-allowed")
    public Result<Void> validateLoginAllowed(@PathVariable("userId") Long userId) {
        userService.validateLoginAllowed(userId);
        return Result.success(null);
    }

    @PostMapping("/{userId:\\d+}/complete-login")
    public Result<UserDTO> completeLogin(@PathVariable("userId") Long userId) {
        return Result.success(userService.toDTO(userService.completeLogin(userId)));
    }

    @PostMapping("/{userId:\\d+}/validate-active-session")
    public Result<Void> validateActiveSession(@PathVariable("userId") Long userId) {
        userService.validateActiveSession(userId);
        return Result.success(null);
    }

    @GetMapping("/batch")
    public Result<List<UserDTO>> getByIds(@RequestParam("ids") List<Long> ids) {
        return Result.success(userService.toDTOList(userService.getByIds(ids)));
    }

    // ===================== 邮箱 =====================

    @GetMapping("/email/{email}")
    public Result<UserDTO> getByEmail(@PathVariable("email") String email) {
        return Result.success(userService.toDTO(userService.getByEmail(email)));
    }

    @PostMapping("/email/{email}")
    public Result<UserDTO> getOrCreateByEmail(@PathVariable("email") String email) {
        return Result.success(userService.toDTO(userService.getOrCreateByEmail(email)));
    }

    @PostMapping("/register-by-email")
    public Result<UserDTO> registerByEmail(@RequestBody EmailRegistrationRequest request) {
        User user = userService.registerByEmail(request.getEmail(), request.getInviteCode());
        return Result.success(userService.toDTO(user));
    }

    @PostMapping("/validate-email-registration")
    public Result<Void> validateEmailRegistration(@RequestBody EmailRegistrationRequest request) {
        userService.validateEmailRegistration(request.getEmail(), request.getInviteCode());
        return Result.success(null);
    }

    // ===================== 手机号 =====================

    @GetMapping("/phone/{phone}")
    public Result<UserDTO> getByPhone(@PathVariable("phone") String phone) {
        return Result.success(userService.toDTO(userService.getByPhone(phone)));
    }

    @PostMapping("/phone/{phone}")
    public Result<UserDTO> getOrCreateByPhone(@PathVariable("phone") String phone) {
        return Result.success(userService.toDTO(userService.getOrCreateByPhone(phone)));
    }

    @PostMapping("/register-by-phone")
    public Result<UserDTO> registerByPhone(@RequestBody PhoneRegistrationRequest request) {
        User user = userService.registerByPhone(request.getPhone(), request.getInviteCode());
        return Result.success(userService.toDTO(user));
    }

    @PostMapping("/validate-phone-registration")
    public Result<Void> validatePhoneRegistration(@RequestBody PhoneRegistrationRequest request) {
        userService.validatePhoneRegistration(request.getPhone(), request.getInviteCode());
        return Result.success(null);
    }

    @PostMapping("/paid-invite-codes/issue")
    public Result<PaidInviteIssueResponse> issuePaidInvite(@RequestBody PaidInviteIssueRequest request) {
        return Result.success(paidInviteCodeService.issue(request.getPhone(), request.getPaymentReference()));
    }

    // ===================== 绑定 =====================

    @PostMapping("/{userId:\\d+}/bind-identity")
    public Result<Void> bindIdentity(
            @PathVariable("userId") Long userId,
            @RequestParam("type") String identityType,
            @RequestParam("identifier") String identifier) {
        userService.bindIdentity(userId, identityType, identifier);
        return Result.success(null);
    }

    @GetMapping({"/stats/registration-capacity", "/stats/beta-invite"})
    public Result<Map<String, Object>> registrationCapacityStats() {
        return Result.success(userService.getRegistrationCapacityStats());
    }

    @PostMapping("/sms-delivery-records")
    public Result<Void> createSmsDeliveryRecord(@RequestBody SmsDeliveryRecordCreateRequest request) {
        smsDeliveryRecordService.record(request);
        return Result.success(null);
    }

    @GetMapping("/sms-delivery-records/accepted")
    public Result<Boolean> hasAcceptedSmsDeliveryEvent(@RequestParam("eventId") String eventId) {
        return Result.success(smsDeliveryRecordService.hasAcceptedEvent(eventId));
    }

    @PostMapping("/sms-delivery-records/verification-used")
    public Result<Boolean> markSmsVerificationUsed(@RequestBody SmsVerificationUsedRequest request) {
        return Result.success(smsDeliveryRecordService.markVerificationUsed(request));
    }

    @PostMapping("/sms-delivery-records/receipt")
    public Result<Boolean> updateSmsDeliveryReceipt(@RequestBody SmsDeliveryReceiptUpdateRequest request) {
        return Result.success(smsDeliveryRecordService.updateReceipt(request));
    }

    @GetMapping("/{userId:\\d+}")
    public Result<UserDTO> getById(@PathVariable("userId") Long userId) {
        User user = userService.getById(userId);
        return Result.success(userService.toDTO(user));
    }
}
