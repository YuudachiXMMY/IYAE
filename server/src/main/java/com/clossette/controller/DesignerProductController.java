package com.clossette.controller;

import com.clossette.dto.CreateProductRequest;
import com.clossette.dto.ProductResponse;
import com.clossette.dto.UpdateProductRequest;
import com.clossette.service.ProductService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/designer/products")
@RequiredArgsConstructor
public class DesignerProductController {

    private final ProductService productService;

    @GetMapping
    public ResponseEntity<List<ProductResponse>> listOwnProducts(Authentication authentication) {
        return ResponseEntity.ok(productService.getDesignerProducts(authentication.getName()));
    }

    @PostMapping
    public ResponseEntity<ProductResponse> createProduct(
            @Valid @RequestBody CreateProductRequest request,
            Authentication authentication
    ) {
        ProductResponse response = productService.createProduct(authentication.getName(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductResponse> updateProduct(
            @PathVariable Long id,
            @Valid @RequestBody UpdateProductRequest request,
            Authentication authentication
    ) {
        return ResponseEntity.ok(productService.updateProduct(authentication.getName(), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(
            @PathVariable Long id,
            Authentication authentication
    ) {
        productService.deleteProduct(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
