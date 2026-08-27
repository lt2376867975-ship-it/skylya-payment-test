package com.skylia.user.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("paid_invite_codes")
public class PaidInviteCode {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String codeBidx;
    private String phoneBidx;
    private String phoneMask;
    private String paymentReference;
    private String status;
    private Long usedByUserId;
    private LocalDateTime issuedAt;
    private LocalDateTime expiresAt;
    private LocalDateTime usedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
