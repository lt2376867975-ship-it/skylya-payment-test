package com.skylia.user.service.impl;

import com.skylia.common.core.exception.BizException;
import com.skylia.common.core.result.ResultCode;
import com.skylia.common.security.crypto.BlindIndexService;
import com.skylia.user.api.dto.PaidInviteIssueResponse;
import com.skylia.user.domain.entity.PaidInviteCode;
import com.skylia.user.mapper.PaidInviteCodeMapper;
import com.skylia.user.service.PaidInviteCodeService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PaidInviteCodeServiceImpl implements PaidInviteCodeService {

    private static final char[] ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final PaidInviteCodeMapper paidInviteCodeMapper;
    private final BlindIndexService blindIndexService;

    @Value("${skylia.invite.valid-days:30}")
    private int validDays;

    @Override
    public PaidInviteIssueResponse issue(String phone, String paymentReference) {
        LocalDateTime now = LocalDateTime.now();
        for (int attempt = 0; attempt < 5; attempt++) {
            String code = generateCode();
            PaidInviteCode row = new PaidInviteCode();
            row.setCodeBidx(blindIndexService.hmacSha256Index(code));
            row.setPhoneBidx(blindIndexService.hmacSha256Index(phone));
            row.setPhoneMask(maskPhone(phone));
            row.setPaymentReference(trimToNull(paymentReference));
            row.setStatus("unused");
            row.setIssuedAt(now);
            row.setExpiresAt(now.plusDays(Math.max(1, validDays)));
            try {
                paidInviteCodeMapper.insert(row);
                return PaidInviteIssueResponse.builder()
                        .id(row.getId())
                        .inviteCode(code)
                        .expiresAt(row.getExpiresAt())
                        .build();
            } catch (DuplicateKeyException duplicateCode) {
                if (attempt == 4) throw duplicateCode;
            }
        }
        throw new BizException(ResultCode.SYSTEM_ERROR);
    }

    @Override
    public void validateAvailable(String inviteCode) {
        PaidInviteCode row = requireExisting(inviteCode);
        if ("used".equals(row.getStatus())) {
            throw new BizException(ResultCode.INVITE_CODE_USED);
        }
        if (!"unused".equals(row.getStatus()) || row.getExpiresAt() == null
                || !row.getExpiresAt().isAfter(LocalDateTime.now())) {
            throw new BizException(ResultCode.INVITE_CODE_INVALID);
        }
    }

    @Override
    public void consume(String inviteCode, Long userId) {
        validateAvailable(inviteCode);
        int updated = paidInviteCodeMapper.consume(
                blindIndexService.hmacSha256Index(normalizeCode(inviteCode)), userId, LocalDateTime.now());
        if (updated != 1) {
            throw new BizException(ResultCode.INVITE_CODE_USED);
        }
    }

    private PaidInviteCode requireExisting(String inviteCode) {
        String normalized = normalizeCode(inviteCode);
        PaidInviteCode row = StringUtils.hasText(normalized)
                ? paidInviteCodeMapper.selectByCodeBidx(blindIndexService.hmacSha256Index(normalized))
                : null;
        if (row == null) throw new BizException(ResultCode.INVITE_CODE_INVALID);
        return row;
    }

    private String normalizeCode(String code) {
        return code == null ? null : code.replace("-", "").trim().toUpperCase(Locale.ROOT);
    }

    private String generateCode() {
        StringBuilder value = new StringBuilder("SKY");
        for (int i = 0; i < 9; i++) value.append(ALPHABET[RANDOM.nextInt(ALPHABET.length)]);
        return value.toString();
    }

    private String maskPhone(String phone) {
        return phone == null || phone.length() != 11
                ? "***"
                : phone.substring(0, 3) + "****" + phone.substring(7);
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
