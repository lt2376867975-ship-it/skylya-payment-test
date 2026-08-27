package com.skylia.auth.service;

import com.skylia.auth.dto.response.SimulateInvitePaymentResponse;

public interface InvitePurchaseSimulationService {
    SimulateInvitePaymentResponse simulate(String phone);
}
