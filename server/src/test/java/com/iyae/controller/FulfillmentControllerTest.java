package com.iyae.controller;

import com.iyae.dto.PickupLocationResponse;
import com.iyae.dto.ShippingOptionResponse;
import com.iyae.service.FulfillmentService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(FulfillmentController.class)
@Import(WebMvcSecurityConfig.class)
class FulfillmentControllerTest {

    @Autowired MockMvc mockMvc;
    @MockBean FulfillmentService fulfillmentService;

    @Test
    void pickupLocations_isPublic_returns200() throws Exception {
        when(fulfillmentService.listActivePickupLocations()).thenReturn(List.of(
                new PickupLocationResponse(1L, "IYAE Studio", "401 Queen St W", "Toronto", "Ring the buzzer")));
        mockMvc.perform(get("/api/fulfillment/pickup-locations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("IYAE Studio"));
    }

    @Test
    void shippingOptions_isPublic_returnsAtLeastTwo() throws Exception {
        when(fulfillmentService.listShippingOptions()).thenReturn(List.of(
                new ShippingOptionResponse("UPS", "UPS", new BigDecimal("12.99")),
                new ShippingOptionResponse("PUROLATOR", "Purolator", new BigDecimal("10.99"))));
        mockMvc.perform(get("/api/fulfillment/shipping-options"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].carrier").value("UPS"))
                .andExpect(jsonPath("$[1].displayName").value("Purolator"));
    }
}
