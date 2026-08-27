package com.skylia.user.service;

import com.skylia.user.api.dto.UserDTO;
import com.skylia.user.domain.entity.User;

import java.util.List;

public interface UserService {

    User getById(Long id);

    List<User> getByIds(List<Long> ids);

    User getByPhone(String phone);

    User getOrCreateByPhone(String phone);

    User getByEmail(String email);

    User getOrCreateByEmail(String email);

    /** 邮箱注册 */
    User registerByEmail(String email, String inviteCode);

    /** 邮箱注册前校验 */
    void validateEmailRegistration(String email, String inviteCode);

    /** 手机号注册 */
    User registerByPhone(String phone, String inviteCode);

    /** 手机号注册前校验 */
    void validatePhoneRegistration(String phone, String inviteCode);

    /** 绑定新的认证方式（邮箱 / 手机号），如已被其他用户占用则报错 */
    void bindIdentity(Long userId, String identityType, String identifier);

    /** 进入 30 天注销冷静期。 */
    void requestAccountDeletion(Long userId, String reason);

    /** 登录发码前校验账号仍允许登录；不会取消注销冷静期。 */
    void validateLoginAllowed(Long userId);

    /** 登录成功后更新登录时间；冷静期内登录会取消注销。 */
    User completeLogin(Long userId);

    /** 刷新令牌前校验账号仍处于正常状态。 */
    void validateActiveSession(Long userId);

    User createUser(String phone);

    User createUserByEmail(String email);

    void updateUser(User user);

    /**
     * 更新登录标识：邮箱非空时校验并写入；手机号非空时校验并写入，传空串表示解绑手机。
     */
    void updateLastLoginTime(Long userId);

    UserDTO toDTO(User user);

    List<UserDTO> toDTOList(List<User> users);

    java.util.Map<String, Object> getRegistrationCapacityStats();
}
