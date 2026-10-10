package com.iyae.controller;

import com.iyae.dto.ProductResponse;
import com.iyae.dto.SavedProductResponse;
import com.iyae.service.SavedProductService;
import com.iyae.testsupport.TestProducts;
import com.iyae.testsupport.WebMvcSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SavedProductController.class)
@Import(WebMvcSecurityConfig.class)
class SavedProductControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    SavedProductService savedProductService;

    private SavedProductResponse sampleEntry() {
        ProductResponse product = ProductResponse.from(TestProducts.aPublishedProduct());
        return new SavedProductResponse(500L, product.id(), product, Instant.now());
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void getSavedProducts_authenticated_returnsTheList() throws Exception {
        when(savedProductService.getSavedProducts("buyer@example.com"))
                .thenReturn(List.of(sampleEntry()));

        mockMvc.perform(get("/api/saved-products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(500L))
                .andExpect(jsonPath("$[0].productId").value(1L))
                .andExpect(jsonPath("$[0].product.name").value("Test Silk Blouse"));
    }

    @Test
    void getSavedProducts_unauthenticated_returns403() throws Exception {
        // 403, not 401: the filter chain has no authentication entry point, so an
        // anonymous request is denied rather than challenged. Matches every other
        // controller test in this package.
        mockMvc.perform(get("/api/saved-products"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void saveProduct_returns200AndPassesThroughTheCallersIdentity() throws Exception {
        when(savedProductService.saveProduct(anyString(), anyLong())).thenReturn(sampleEntry());

        // PUT, not POST: membership of a set is idempotent, so a replayed save
        // must be a 200 rather than a duplicate or a 409.
        mockMvc.perform(put("/api/saved-products/1").with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productId").value(1L));

        verify(savedProductService).saveProduct("buyer@example.com", 1L);
    }

    @Test
    void saveProduct_unauthenticated_returns403() throws Exception {
        mockMvc.perform(put("/api/saved-products/1").with(csrf()))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "buyer@example.com")
    void removeProduct_returns204() throws Exception {
        doNothing().when(savedProductService).removeProduct(anyString(), anyLong());

        mockMvc.perform(delete("/api/saved-products/1").with(csrf()))
                .andExpect(status().isNoContent());

        verify(savedProductService).removeProduct("buyer@example.com", 1L);
    }

    @Test
    void removeProduct_unauthenticated_returns403() throws Exception {
        mockMvc.perform(delete("/api/saved-products/1").with(csrf()))
                .andExpect(status().isForbidden());
    }
}
