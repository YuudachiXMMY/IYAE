package com.iyae.config;

import com.iyae.ai.AIProviderException;
import com.iyae.dto.ErrorResponse;
import com.iyae.service.AuthMailService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .collect(Collectors.joining("; "));
        return ResponseEntity.badRequest()
            .body(new ErrorResponse(message, HttpStatus.BAD_REQUEST.value(), Instant.now()));
    }

    @ExceptionHandler(AIProviderException.class)
    public ResponseEntity<ErrorResponse> handleAIProviderException(AIProviderException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(new ErrorResponse("AI service unavailable: " + ex.getMessage(), HttpStatus.SERVICE_UNAVAILABLE.value(), Instant.now()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(new ErrorResponse("Access denied", HttpStatus.FORBIDDEN.value(), Instant.now()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleHttpMessageNotReadable(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest()
            .body(new ErrorResponse("Invalid request data", HttpStatus.BAD_REQUEST.value(), Instant.now()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
            .body(new ErrorResponse(ex.getMessage(), HttpStatus.BAD_REQUEST.value(), Instant.now()));
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        String msg = ex.getMostSpecificCause().getMessage();
        if (msg != null && msg.toLowerCase().contains("username")) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse("Username already taken", HttpStatus.CONFLICT.value(), Instant.now()));
        }
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse("Data conflict: please retry", HttpStatus.CONFLICT.value(), Instant.now()));
    }

    @ExceptionHandler(AuthMailService.EmailDeliveryException.class)
    public ResponseEntity<ErrorResponse> handleEmailDelivery(AuthMailService.EmailDeliveryException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(new ErrorResponse("Email service unavailable: " + ex.getMessage(), HttpStatus.SERVICE_UNAVAILABLE.value(), Instant.now()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> handleRuntime(RuntimeException ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErrorResponse("Internal server error", HttpStatus.INTERNAL_SERVER_ERROR.value(), Instant.now()));
    }
}
