package com.skylia.user.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.skylia.user.domain.entity.PaidInviteCode;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

@Mapper
public interface PaidInviteCodeMapper extends BaseMapper<PaidInviteCode> {

    @Select("SELECT * FROM paid_invite_codes WHERE code_bidx = #{codeBidx} LIMIT 1")
    PaidInviteCode selectByCodeBidx(@Param("codeBidx") String codeBidx);

    @Update("""
            UPDATE paid_invite_codes
            SET status = 'used', used_by_user_id = #{userId}, used_at = #{usedAt}
            WHERE code_bidx = #{codeBidx}
              AND status = 'unused'
              AND expires_at > #{usedAt}
            """)
    int consume(@Param("codeBidx") String codeBidx,
                @Param("userId") Long userId,
                @Param("usedAt") LocalDateTime usedAt);
}
