package com.iyae.controller;

import com.iyae.dto.ProductResponse;
import com.iyae.dto.ProductStatusUpdateRequest;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.service.AdminModerationService;
import com.iyae.testsupport.WebMvcSecurityConfig;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminController.class)
@Import(WebMvcSecurityConfig.class)
class AdminControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    AdminModerationService adminModerationService;

    private ProductResponse sampleProduct() {
        return new ProductResponse(
                1L, 1L, "Luna Studio", "Top", "desc",
                new BigDecimal("59.99"), "CAD", "Tops",
                Collections.emptyList(), Collections.emptyList(), List.of("S", "M"),
                Collections.emptyList(), null, ProductStatus.ARCHIVED,
                Instant.now(), Instant.now(), null, null, null,
                false, null, null, null);
    }

    // ---- Role gating: list ----

    @Test
    @WithMockUser(username = "admin@iyae.ca", roles = "ADMIN")
    void listProducts_admin_returns200() throws Exception {
        when(adminModerationService.listAllProducts(any())).thenReturn(List.of(sampleProduct()));

        mockMvc.perform(get("/api/admin/products"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "designer@iyae.ca", roles = "DESIGNER")
    void listProducts_designer_returns403() throws Exception {
        mockMvc.perform(get("/api/admin/products"))
                .andExpect(status().isForbidden());
    }

    @Test
    void listProducts_anonymous_isClientError() throws Exception {
        mockMvc.perform(get("/api/admin/products"))
                .andExpect(status().is4xxClientError());
    }

    // ---- Role gating: force status ----

    @Test
    @WithMockUser(username = "admin@iyae.ca", roles = "ADMIN")
    void setProductStatus_admin_returns200() throws Exception {
        when(adminModerationService.setProductStatus(eq(1L), eq(ProductStatus.ARCHIVED)))
                .thenReturn(sampleProduct());

        mockMvc.perform(put("/api/admin/products/1/status")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductStatusUpdateRequest(ProductStatus.ARCHIVED))))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "buyer@iyae.ca", roles = "BUYER")
    void setProductStatus_buyer_returns403() throws Exception {
        mockMvc.perform(put("/api/admin/products/1/status")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ProductStatusUpdateRequest(ProductStatus.ARCHIVED))))
                .andExpect(status().isForbidden());
    }
}
