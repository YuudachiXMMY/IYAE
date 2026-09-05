package com.iyae;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class IyaeApplication {
    public static void main(String[] args) {
        SpringApplication.run(IyaeApplication.class, args);
    }
}
