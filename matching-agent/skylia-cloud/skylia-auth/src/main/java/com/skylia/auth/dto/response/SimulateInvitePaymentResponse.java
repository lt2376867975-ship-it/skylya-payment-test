package com.skylia.auth.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SimulateInvitePaymentResponse {
    private String inviteCode;
    private String phoneMask;
    private String smsStatus;
    private String message;
    private LocalDateTime expiresAt;
}
