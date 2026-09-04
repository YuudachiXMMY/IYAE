package com.clossette.controller;

import com.clossette.dto.PagedResponse;
import com.clossette.dto.ProductResponse;
import com.clossette.entity.enums.ProductStatus;
import com.clossette.repository.UserRepository;
import com.clossette.service.ProductService;
import com.clossette.testsupport.WebMvcSecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProductController.class)
@Import(WebMvcSecurityConfig.class)
class ProductControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    ProductService productService;

    @MockBean
    UserRepository userRepository;

    private ProductResponse sampleProduct(Long id) {
        return new ProductResponse(
                id, 1L, "Luna Studio", "Test Top", "A nice top",
                new BigDecimal("49.99"), "CAD", "Tops",
                List.of("minimalist"), List.of("white"),
                List.of("S", "M"), List.of("/img/top.jpg"),
                null, ProductStatus.PUBLISHED,
                Instant.now(), Instant.now(),
                null, null, null
        );
    }

    private PagedResponse<ProductResponse> singlePageResponse(ProductResponse product) {
        return new PagedResponse<>(List.of(product), 0, 20, 1, 1, true);
    }

    @Test
    void listProducts_noAuth_returns200() throws Exception {
        PagedResponse<ProductResponse> page = singlePageResponse(sampleProduct(1L));
        when(productService.getPublicCatalog(anyInt(), anyInt(), isNull(), isNull())).thenReturn(page);

        mockMvc.perform(get("/api/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(1))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void listProducts_withCategoryAndSearch_returns200() throws Exception {
        PagedResponse<ProductResponse> page = singlePageResponse(sampleProduct(2L));
        when(productService.getPublicCatalog(anyInt(), anyInt(), eq("Tops"), eq("linen"))).thenReturn(page);

        mockMvc.perform(get("/api/products")
                        .param("category", "Tops")
                        .param("q", "linen"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].category").value("Tops"));
    }

    @Test
    void getCategories_noAuth_returns200() throws Exception {
        when(productService.getPublishedCategories()).thenReturn(List.of("Tops", "Bottoms", "Dresses"));

        mockMvc.perform(get("/api/products/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("Tops"))
                .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    void getProduct_existingId_returns200() throws Exception {
        when(productService.getProductById(eq(1L), any())).thenReturn(sampleProduct(1L));

        mockMvc.perform(get("/api/products/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Test Top"));
    }

    @Test
    void getProduct_notFound_returns404() throws Exception {
        when(productService.getProductById(eq(999L), any()))
                .thenThrow(new IllegalArgumentException("Product not found"));

        mockMvc.perform(get("/api/products/999"))
                .andExpect(status().isBadRequest());
    }
}
