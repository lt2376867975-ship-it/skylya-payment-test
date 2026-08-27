package com.skylia.auth.service;

import java.time.LocalDateTime;

public interface NotificationSmsService {

    void sendMatchSuccess(Long userId, String phone, String eventId);

    void sendAppointmentConfirmed(Long userId, String phone, String confirmedTimeText, String eventId);

    void sendMatchCycleTimeout(Long userId, String phone, String eventId);

    void sendRegistrationVerificationCode(
            String phone, String code, String eventId, LocalDateTime codeExpiresAt);

    void sendPaidInviteCode(String phone, String inviteCode, String eventId);
}
