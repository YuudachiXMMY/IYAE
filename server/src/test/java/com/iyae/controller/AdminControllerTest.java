package com.iyae.controller;

import com.iyae.dto.AdminPostResponse;
import com.iyae.dto.PagedResponse;
import com.iyae.dto.PostReportResponse;
import com.iyae.dto.ProductResponse;
import com.iyae.dto.ProductStatusUpdateRequest;
import com.iyae.dto.PromotionResponse;
import com.iyae.dto.PromotionSlotUpdateRequest;
import com.iyae.entity.enums.PostStatus;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.entity.enums.ReportStatus;
import com.iyae.entity.enums.SlotType;
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

    private AdminPostResponse sampleAdminPost() {
        return new AdminPostResponse(1L, 1L, "Author", "author", "hi", PostStatus.ACTIVE, Instant.now());
    }

    private PromotionResponse samplePromotion() {
        return new PromotionResponse(3L, 5L, SlotType.FEATURED, 10, null, null);
    }

    private PostReportResponse sampleReport() {
        return new PostReportResponse(1L, 7L, 9L, "reporter", "spam", ReportStatus.OPEN, Instant.now());
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

    // ---- Community moderation endpoints (PR#10 L7) ----

    @Test
    @WithMockUser(username = "admin@iyae.ca", roles = "ADMIN")
    void listPosts_admin_returns200() throws Exception {
        when(adminModerationService.listPostsForModeration(any())).thenReturn(List.of(sampleAdminPost()));

        mockMvc.perform(get("/api/admin/posts"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "admin@iyae.ca", roles = "ADMIN")
    void archivePost_admin_returns200() throws Exception {
        when(adminModerationService.archivePost(eq(7L))).thenReturn(sampleAdminPost());

        mockMvc.perform(put("/api/admin/posts/7/archive").with(csrf()))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "admin@iyae.ca", roles = "ADMIN")
    void removePost_admin_returns200() throws Exception {
        when(adminModerationService.removePost(eq(7L))).thenReturn(sampleAdminPost());

        mockMvc.perform(put("/api/admin/posts/7/remove").with(csrf()))
                .andExpect(status().isOk());
    }

    // ---- Promotion moderation endpoints (PR#10 L7) ----

    @Test
    @WithMockUser(username = "admin@iyae.ca", roles = "ADMIN")
    void listPromotions_admin_returns200() throws Exception {
        when(adminModerationService.listPromotions()).thenReturn(List.of(samplePromotion()));

        mockMvc.perform(get("/api/admin/promotions"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "admin@iyae.ca", roles = "ADMIN")
    void setPromotionSlot_admin_returns200() throws Exception {
        when(adminModerationService.setPromotionSlot(eq(3L), eq(SlotType.FEATURED)))
                .thenReturn(samplePromotion());

        mockMvc.perform(put("/api/admin/promotions/3/slot")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PromotionSlotUpdateRequest(SlotType.FEATURED))))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "designer@iyae.ca", roles = "DESIGNER")
    void setPromotionSlot_designer_returns403() throws Exception {
        mockMvc.perform(put("/api/admin/promotions/3/slot")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new PromotionSlotUpdateRequest(SlotType.FEATURED))))
                .andExpect(status().isForbidden());
    }

    // ---- Phase 6: report queue + comment moderation ----

    @Test
    @WithMockUser(username = "admin@iyae.ca", roles = "ADMIN")
    void listReports_admin_returns200() throws Exception {
        when(adminModerationService.listReports(any(), eq(0), eq(20)))
                .thenReturn(new PagedResponse<>(List.of(sampleReport()), 0, 20, 1L, 1, true));

        mockMvc.perform(get("/api/admin/reports"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "buyer@iyae.ca", roles = "BUYER")
    void listReports_buyer_returns403() throws Exception {
        mockMvc.perform(get("/api/admin/reports"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "admin@iyae.ca", roles = "ADMIN")
    void resolveReport_admin_returns200() throws Exception {
        when(adminModerationService.resolveReport(eq(1L), eq(ReportStatus.RESOLVED), eq(true)))
                .thenReturn(sampleReport());

        mockMvc.perform(put("/api/admin/reports/1/resolve")
                        .with(csrf())
                        .param("status", "RESOLVED")
                        .param("removePost", "true"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(username = "admin@iyae.ca", roles = "ADMIN")
    void removeComment_admin_returns204() throws Exception {
        mockMvc.perform(put("/api/admin/comments/9/remove").with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    @WithMockUser(username = "designer@iyae.ca", roles = "DESIGNER")
    void removeComment_designer_returns403() throws Exception {
        mockMvc.perform(put("/api/admin/comments/9/remove").with(csrf()))
                .andExpect(status().isForbidden());
    }
}
