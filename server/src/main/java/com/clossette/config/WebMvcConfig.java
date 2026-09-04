package com.clossette.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${worker.output-dir:/var/clossette/assets}")
    private String assetRoot;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = assetRoot.startsWith("file:") ? assetRoot : "file:" + assetRoot;
        if (!location.endsWith("/")) {
            location += "/";
        }

        registry.addResourceHandler("/assets/**")
                .addResourceLocations(location);

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(location + "uploads/");
    }
}
