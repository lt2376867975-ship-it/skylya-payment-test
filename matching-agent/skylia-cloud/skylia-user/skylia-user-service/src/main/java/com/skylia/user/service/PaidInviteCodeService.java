package com.skylia.user.service;

import com.skylia.user.api.dto.PaidInviteIssueResponse;

public interface PaidInviteCodeService {
    PaidInviteIssueResponse issue(String phone, String paymentReference);
    void validateAvailable(String inviteCode);
    void consume(String inviteCode, Long userId);
}
