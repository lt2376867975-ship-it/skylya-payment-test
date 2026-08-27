package com.skylia.auth.controller;

import com.skylia.auth.dto.request.SimulateInvitePaymentRequest;
import com.skylia.auth.dto.response.SimulateInvitePaymentResponse;
import com.skylia.auth.service.InvitePurchaseSimulationService;
import com.skylia.common.core.result.Result;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/invite-codes")
@RequiredArgsConstructor
public class InvitePurchaseController {
    private final InvitePurchaseSimulationService invitePurchaseSimulationService;

    @PostMapping("/simulate-payment")
    public Result<SimulateInvitePaymentResponse> simulatePayment(
            @Valid @RequestBody SimulateInvitePaymentRequest request) {
        return Result.success(invitePurchaseSimulationService.simulate(request.getPhone()));
    }
}
