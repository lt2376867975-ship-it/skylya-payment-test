package com.skylia.user.service.impl;

import com.skylia.common.core.exception.BizException;
import com.skylia.common.core.result.ResultCode;
import com.skylia.common.security.crypto.BlindIndexService;
import com.skylia.user.domain.entity.PaidInviteCode;
import com.skylia.user.mapper.PaidInviteCodeMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaidInviteCodeServiceImplTest {

    @Mock private PaidInviteCodeMapper mapper;
    @Mock private BlindIndexService blindIndexService;
    private PaidInviteCodeServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PaidInviteCodeServiceImpl(mapper, blindIndexService);
        ReflectionTestUtils.setField(service, "validDays", 30);
        when(blindIndexService.hmacSha256Index(anyString()))
                .thenAnswer(invocation -> "bidx-" + invocation.getArgument(0));
    }

    @Test
    void issueReturnsPlainCodeOnceButPersistsOnlyBlindIndexesAndMask() {
        doAnswer(invocation -> {
            PaidInviteCode row = invocation.getArgument(0);
            row.setId(7L);
            return 1;
        }).when(mapper).insert(any(PaidInviteCode.class));

        var issued = service.issue("13800000000", "SIM-1");

        assertThat(issued.getInviteCode()).matches("SKY[23456789A-HJ-NP-Z]{9}");
        assertThat(issued.getId()).isEqualTo(7L);
        verify(mapper).insert(org.mockito.ArgumentMatchers.argThat(row ->
                row.getCodeBidx().startsWith("bidx-SKY")
                        && "bidx-13800000000".equals(row.getPhoneBidx())
                        && "138****0000".equals(row.getPhoneMask())));
    }

    @Test
    void secondConsumptionIsRejected() {
        PaidInviteCode available = new PaidInviteCode();
        available.setStatus("unused");
        available.setExpiresAt(LocalDateTime.now().plusDays(1));
        when(mapper.selectByCodeBidx("bidx-SKYTEST12345")).thenReturn(available);
        when(mapper.consume(eq("bidx-SKYTEST12345"), eq(9L), any(LocalDateTime.class))).thenReturn(0);

        assertThatThrownBy(() -> service.consume("SKYTEST12345", 9L))
                .isInstanceOf(BizException.class)
                .extracting("code")
                .isEqualTo(ResultCode.INVITE_CODE_USED.getCode());
    }
}
