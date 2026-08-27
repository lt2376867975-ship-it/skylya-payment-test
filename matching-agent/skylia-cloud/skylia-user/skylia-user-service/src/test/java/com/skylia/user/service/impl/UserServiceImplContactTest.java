package com.skylia.user.service.impl;

import com.skylia.common.core.exception.BizException;
import com.skylia.common.core.result.ResultCode;
import com.skylia.common.security.crypto.BlindIndexService;
import com.skylia.common.security.crypto.CryptoService;
import com.skylia.match.api.MatchFeignClient;
import com.skylia.profile.api.ProfileFeignClient;
import com.skylia.user.domain.entity.User;
import com.skylia.user.domain.entity.UserAuth;
import com.skylia.user.mapper.AccountDeletionArchiveMapper;
import com.skylia.user.mapper.UserAuthMapper;
import com.skylia.user.mapper.UserMapper;
import com.skylia.user.service.UserFeedbackService;
import com.skylia.user.service.PaidInviteCodeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserServiceImplContactTest {

    private static final long CURRENT_USER_ID = 100L;
    private static final long OTHER_USER_ID = 200L;

    private UserMapper userMapper;
    private UserAuthMapper userAuthMapper;
    private BlindIndexService blindIndexService;
    private UserServiceImpl userService;

    @BeforeEach
    void setUp() {
        userMapper = mock(UserMapper.class);
        userAuthMapper = mock(UserAuthMapper.class);
        blindIndexService = mock(BlindIndexService.class);
        userService = new UserServiceImpl(
                userMapper,
                userAuthMapper,
                mock(AccountDeletionArchiveMapper.class),
                mock(ProfileFeignClient.class),
                mock(MatchFeignClient.class),
                mock(CryptoService.class),
                blindIndexService,
                mock(PaidInviteCodeService.class),
                mock(UserFeedbackService.class));

        User currentUser = new User();
        currentUser.setId(CURRENT_USER_ID);
        when(userMapper.selectById(CURRENT_USER_ID)).thenReturn(currentUser);
    }

    @Test
    void bindIdentityExplainsWhenEmailIsBoundToAnotherAccount() {
        mockIdentityTakenByOtherUser("email", "person@example.com");

        assertThatThrownBy(() -> userService.bindIdentity(
                CURRENT_USER_ID, "email", "person@example.com"))
                .isInstanceOf(BizException.class)
                .extracting("code", "message")
                .containsExactly(ResultCode.USER_ALREADY_EXISTS.getCode(), "该邮箱已被其他账号绑定");
    }

    @Test
    void bindIdentityExplainsWhenPhoneIsBoundToAnotherAccount() {
        mockIdentityTakenByOtherUser("phone", "13800138000");

        assertThatThrownBy(() -> userService.bindIdentity(
                CURRENT_USER_ID, "phone", "13800138000"))
                .isInstanceOf(BizException.class)
                .extracting("code", "message")
                .containsExactly(ResultCode.USER_ALREADY_EXISTS.getCode(), "该手机号已被其他账号绑定");
    }

    private void mockIdentityTakenByOtherUser(String type, String identifier) {
        String blindIndex = "blind-index-" + type;
        UserAuth taken = new UserAuth();
        taken.setUserId(OTHER_USER_ID);
        when(blindIndexService.hmacSha256Index(identifier)).thenReturn(blindIndex);
        when(userAuthMapper.selectAnyByIdentity(type, blindIndex)).thenReturn(taken);
    }
}
