package com.iyae.controller;

import com.iyae.dto.CreateProductRequest;
import com.iyae.dto.ProductResponse;
import com.iyae.dto.UpdateProductRequest;
import com.iyae.entity.enums.ProductStatus;
import com.iyae.service.ProductService;
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

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DesignerProductController.class)
@Import(WebMvcSecurityConfig.class)
class DesignerProductControllerTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockBean
    ProductService productService;

    private ProductResponse sampleProduct() {
        return new ProductResponse(
                1L, 1L, "Luna Studio", "Linen Shirt", "A nice shirt",
                new BigDecimal("59.99"), "CAD", "Tops",
                Collections.emptyList(), Collections.emptyList(), List.of("S", "M", "L"),
                Collections.emptyList(), null, ProductStatus.DRAFT,
                Instant.now(), Instant.now(), null, null, null
        );
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void listDesignerProducts_designer_returns200() throws Exception {
        when(productService.getDesignerProducts("designer@example.com")).thenReturn(List.of(sampleProduct()));

        mockMvc.perform(get("/api/designer/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].name").value("Linen Shirt"));
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void createProduct_designer_returns201() throws Exception {
        when(productService.createProduct(eq("designer@example.com"), any())).thenReturn(sampleProduct());

        CreateProductRequest req = new CreateProductRequest(
                "Linen Shirt", "A nice shirt", new BigDecimal("59.99"),
                "CAD", "Tops", null, null, List.of("S", "M", "L"), null, null);

        mockMvc.perform(post("/api/designer/products")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Linen Shirt"));
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void updateProduct_designer_returns200() throws Exception {
        ProductResponse updated = new ProductResponse(
                1L, 1L, "Luna Studio", "Updated Shirt", "Updated desc",
                new BigDecimal("69.99"), "CAD", "Tops",
                Collections.emptyList(), Collections.emptyList(), List.of("S", "M"),
                Collections.emptyList(), null, ProductStatus.PUBLISHED,
                Instant.now(), Instant.now(), null, null, null
        );
        when(productService.updateProduct(eq("designer@example.com"), eq(1L), any())).thenReturn(updated);

        UpdateProductRequest req = new UpdateProductRequest(
                "Updated Shirt", "Updated desc", new BigDecimal("69.99"),
                "CAD", "Tops", null, null, List.of("S", "M"), null, null, ProductStatus.PUBLISHED);

        mockMvc.perform(put("/api/designer/products/1")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Updated Shirt"));
    }

    @Test
    @WithMockUser(username = "designer@example.com", roles = "DESIGNER")
    void deleteProduct_designer_returns204() throws Exception {
        doNothing().when(productService).deleteProduct(eq("designer@example.com"), eq(1L));

        mockMvc.perform(delete("/api/designer/products/1")
                        .with(csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    @WithMockUser(username = "buyer@example.com", roles = "BUYER")
    void listDesignerProducts_buyer_returns403() throws Exception {
        mockMvc.perform(get("/api/designer/products"))
                .andExpect(status().isForbidden());
    }
}
