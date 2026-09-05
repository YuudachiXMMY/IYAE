package com.iyae.config;

import com.iyae.entity.*;
import com.iyae.entity.enums.*;
import com.iyae.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Slf4j
@Component
@Profile("!prod")
@Order(2)
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final DesignerProfileRepository designerProfileRepository;
    private final BodyProfileRepository bodyProfileRepository;
    private final ProductRepository productRepository;
    private final PromotionRepository promotionRepository;
    private final GarmentAssetRepository garmentAssetRepository;
    private final PasswordEncoder passwordEncoder;
    private final BrandProperties brandProperties;

    private static final String GLB_URL = "/assets/models/placeholder.glb";

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("DataSeeder: data already exists, skipping seed.");
            return;
        }

        log.info("DataSeeder: seeding initial data...");

        // 1. Create users
        String encodedPassword = passwordEncoder.encode("password123");
        String domain = brandProperties.domain();

        User luna = userRepository.save(User.builder()
                .email("luna@" + domain)
                .passwordHash(encodedPassword)
                .name("Luna Kim")
                .role(Role.DESIGNER)
                .emailVerified(true)
                .build());

        User marco = userRepository.save(User.builder()
                .email("marco@" + domain)
                .passwordHash(encodedPassword)
                .name("Marco Voss")
                .role(Role.DESIGNER)
                .emailVerified(true)
                .build());

        User aria = userRepository.save(User.builder()
                .email("aria@" + domain)
                .passwordHash(encodedPassword)
                .name("Aria Chen")
                .role(Role.DESIGNER)
                .emailVerified(true)
                .build());

        User emma = userRepository.save(User.builder()
                .email("emma@" + domain)
                .passwordHash(encodedPassword)
                .name("Emma Wilson")
                .role(Role.BUYER)
                .emailVerified(true)
                .build());

        User james = userRepository.save(User.builder()
                .email("james@" + domain)
                .passwordHash(encodedPassword)
                .name("James Park")
                .role(Role.BUYER)
                .emailVerified(true)
                .build());

        // 2. Create designer profiles
        DesignerProfile lunaProfile = designerProfileRepository.save(DesignerProfile.builder()
                .user(luna)
                .displayName("Luna Kim")
                .shopName("Luna Studio")
                .bio("Minimalist aesthetic rooted in clean silhouettes and purposeful design. Every piece tells a quiet story.")
                .build());

        DesignerProfile marcoProfile = designerProfileRepository.save(DesignerProfile.builder()
                .user(marco)
                .displayName("Marco Voss")
                .shopName("VOSS")
                .bio("Streetwear born from urban energy. Bold graphics, oversized cuts, and culture-driven drops.")
                .build());

        DesignerProfile ariaProfile = designerProfileRepository.save(DesignerProfile.builder()
                .user(aria)
                .displayName("Aria Chen")
                .shopName("Aria Atelier")
                .bio("Artisanal handcraft meets slow fashion. Each garment is individually made with organic materials and old-world techniques.")
                .build());

        // 3. Create body profiles for buyers
        bodyProfileRepository.save(BodyProfile.builder()
                .user(emma)
                .heightCm(168.0)
                .weightKg(58.0)
                .chestCm(88.0)
                .waistCm(66.0)
                .hipsCm(92.0)
                .build());

        bodyProfileRepository.save(BodyProfile.builder()
                .user(james)
                .heightCm(180.0)
                .weightKg(75.0)
                .chestCm(96.0)
                .waistCm(82.0)
                .hipsCm(95.0)
                .build());

        // 4. Create 36 PUBLISHED products
        String placeholder = "[\"/assets/images/products/placeholder.svg\"]";

        // --- TOPS: 7 products (3 Luna, 2 Marco, 2 Aria) ---
        Product lunaTop1 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Structured Ivory Shell Top")
                .description("A tailored shell top cut from crisp cotton poplin. Architectural seaming creates dimension without bulk, pairing effortlessly with wide-leg trousers or minimalist skirts.")
                .price(new BigDecimal("88.00"))
                .currency("CAD")
                .category("Tops")
                .styleTags("[\"clean-lines\",\"minimal\",\"structured\"]")
                .colorTags("[\"ivory\",\"white\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product lunaTop2 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Monochrome Fitted Turtleneck")
                .description("A sleek ribbed-knit turtleneck in tonal charcoal grey. A wardrobe staple for the modern minimalist — layer it under blazers or wear it alone for understated elegance.")
                .price(new BigDecimal("72.00"))
                .currency("CAD")
                .category("Tops")
                .styleTags("[\"minimal\",\"monochrome\",\"tailored\"]")
                .colorTags("[\"charcoal\",\"grey\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\",\"XL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product lunaTop3 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Clean-Cut Linen Shirt")
                .description("Relaxed yet refined, this unstructured linen shirt features a banded collar and hidden placket. Effortlessly transitions from work to weekend in navy or cream.")
                .price(new BigDecimal("95.00"))
                .currency("CAD")
                .category("Tops")
                .styleTags("[\"clean-lines\",\"minimal\",\"structured\"]")
                .colorTags("[\"navy\",\"cream\"]")
                .sizes("[\"S\",\"M\",\"L\",\"XL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product marcoTop1 = productRepository.save(Product.builder()
                .designerProfile(marcoProfile)
                .name("Oversized Graphic Tee — VOSS Logo")
                .description("The signature VOSS drop-shoulder tee. Heavyweight 280gsm cotton with a distressed logo screen print. Size up for the authentic streetwear fit.")
                .price(new BigDecimal("58.00"))
                .currency("CAD")
                .category("Tops")
                .styleTags("[\"urban\",\"oversized\",\"graphic\",\"bold\",\"casual\"]")
                .colorTags("[\"black\",\"white\"]")
                .sizes("[\"S\",\"M\",\"L\",\"XL\",\"XXL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product marcoTop2 = productRepository.save(Product.builder()
                .designerProfile(marcoProfile)
                .name("Cobalt Bold Hoodie")
                .description("A statement hoodie in electric cobalt. Kangaroo pocket, brushed fleece interior, and a boxy silhouette built for the streets. Bold in every sense.")
                .price(new BigDecimal("110.00"))
                .currency("CAD")
                .category("Tops")
                .styleTags("[\"urban\",\"oversized\",\"bold\",\"casual\"]")
                .colorTags("[\"cobalt\"]")
                .sizes("[\"S\",\"M\",\"L\",\"XL\",\"XXL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product ariaTop1 = productRepository.save(Product.builder()
                .designerProfile(ariaProfile)
                .name("Handwoven Terracotta Blouse")
                .description("Woven by hand on a floor loom using natural terracotta-dyed cotton. The irregular texture is intentional — a signature of Aria Atelier's handcraft ethos. One-of-a-kind wearable art.")
                .price(new BigDecimal("145.00"))
                .currency("CAD")
                .category("Tops")
                .styleTags("[\"handcrafted\",\"bohemian\",\"textured\",\"organic\"]")
                .colorTags("[\"terracotta\",\"rust\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product ariaTop2 = productRepository.save(Product.builder()
                .designerProfile(ariaProfile)
                .name("Vintage Patchwork Peasant Top")
                .description("A bohemian patchwork blouse assembled from vintage fabric swatches — no two are identical. Smocked cuffs and an elastic neckline lend casual ease to artisanal detailing.")
                .price(new BigDecimal("128.00"))
                .currency("CAD")
                .category("Tops")
                .styleTags("[\"handcrafted\",\"bohemian\",\"vintage\",\"textured\"]")
                .colorTags("[\"sage\",\"ivory\",\"burgundy\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        // --- BOTTOMS: 7 products ---
        Product lunaBottom1 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Wide-Leg Tailored Trousers")
                .description("Floor-grazing wide-leg trousers in fluid crepe. A minimalist essential that reads polished at the office and effortless on weekends. Invisible side-zip closure.")
                .price(new BigDecimal("115.00"))
                .currency("CAD")
                .category("Bottoms")
                .styleTags("[\"clean-lines\",\"tailored\",\"minimal\"]")
                .colorTags("[\"black\",\"charcoal\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\",\"XL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product lunaBottom2 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Structured Midi Skirt")
                .description("An A-line midi skirt with a concealed zip and subtle front pleat. The stiff canvas construction holds its shape beautifully — clean, architectural, timeless.")
                .price(new BigDecimal("98.00"))
                .currency("CAD")
                .category("Bottoms")
                .styleTags("[\"structured\",\"clean-lines\",\"tailored\"]")
                .colorTags("[\"cream\",\"white\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product marcoBottom1 = productRepository.save(Product.builder()
                .designerProfile(marcoProfile)
                .name("Cargo Track Pants")
                .description("Utility-inspired track pants with multi-pocket cargo detailing. Elastic waistband, tapered ankle, and water-resistant ripstop fabric. Streetwear functionality meets comfort.")
                .price(new BigDecimal("98.00"))
                .currency("CAD")
                .category("Bottoms")
                .styleTags("[\"urban\",\"bold\",\"casual\",\"oversized\"]")
                .colorTags("[\"olive\",\"black\"]")
                .sizes("[\"S\",\"M\",\"L\",\"XL\",\"XXL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product marcoBottom2 = productRepository.save(Product.builder()
                .designerProfile(marcoProfile)
                .name("Denim Painter Shorts")
                .description("Baggy painter shorts in raw selvedge denim. Multiple utility pockets and a relaxed fit ideal for the warmer months. Distressed hem adds edge without trying too hard.")
                .price(new BigDecimal("85.00"))
                .currency("CAD")
                .category("Bottoms")
                .styleTags("[\"urban\",\"casual\",\"graphic\",\"bold\"]")
                .colorTags("[\"navy\",\"charcoal\"]")
                .sizes("[\"S\",\"M\",\"L\",\"XL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product ariaBottom1 = productRepository.save(Product.builder()
                .designerProfile(ariaProfile)
                .name("Linen Wrap Skirt in Natural Sage")
                .description("Hand-finished with a fringe hem, this breathable linen wrap skirt embraces the natural slub of the fabric. Ties at the waist for an adjustable, flattering fit on every body.")
                .price(new BigDecimal("118.00"))
                .currency("CAD")
                .category("Bottoms")
                .styleTags("[\"handcrafted\",\"organic\",\"bohemian\",\"textured\"]")
                .colorTags("[\"sage\",\"ivory\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\",\"XL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product ariaBottom2 = productRepository.save(Product.builder()
                .designerProfile(ariaProfile)
                .name("Block-Print Tiered Maxi Skirt")
                .description("Block-printed by hand in Jaipur, this tiered maxi skirt features a botanical motif in rust and ivory. An heirloom piece that ages beautifully with every wash.")
                .price(new BigDecimal("155.00"))
                .currency("CAD")
                .category("Bottoms")
                .styleTags("[\"handcrafted\",\"vintage\",\"bohemian\",\"organic\"]")
                .colorTags("[\"rust\",\"ivory\",\"terracotta\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product lunaBottom3 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Slim Cigarette Trousers")
                .description("Streamlined cigarette-cut trousers with a cropped ankle and side pockets. Cut from a wool-blend suiting fabric in classic navy — the backbone of any minimalist wardrobe.")
                .price(new BigDecimal("108.00"))
                .currency("CAD")
                .category("Bottoms")
                .styleTags("[\"tailored\",\"structured\",\"clean-lines\",\"minimal\"]")
                .colorTags("[\"navy\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\",\"XL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        // --- DRESSES: 4 products ---
        Product lunaDress1 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Column Slip Dress")
                .description("Bias-cut silk charmeuse slip dress with a column silhouette and delicate adjustable straps. Minimal in design, maximum in impact. Wear alone or layered under a blazer.")
                .price(new BigDecimal("165.00"))
                .currency("CAD")
                .category("Dresses")
                .styleTags("[\"minimal\",\"clean-lines\",\"structured\"]")
                .colorTags("[\"black\",\"ivory\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product marcoDress1 = productRepository.save(Product.builder()
                .designerProfile(marcoProfile)
                .name("Graphic Shirt Dress")
                .description("An oversized button-through shirt dress with all-over logo repeat print. Equal parts statement piece and streetwear staple. Belted or loose — you decide the silhouette.")
                .price(new BigDecimal("138.00"))
                .currency("CAD")
                .category("Dresses")
                .styleTags("[\"graphic\",\"oversized\",\"urban\",\"bold\"]")
                .colorTags("[\"black\",\"white\"]")
                .sizes("[\"S\",\"M\",\"L\",\"XL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product ariaDress1 = productRepository.save(Product.builder()
                .designerProfile(ariaProfile)
                .name("Hand-Embroidered Boho Maxi Dress")
                .description("Entirely hand-embroidered on breathable cotton gauze, this maxi dress is a labor of love — over 40 hours of artisan work per piece. A flowing silhouette with deep pockets and a smocked bodice.")
                .price(new BigDecimal("220.00"))
                .currency("CAD")
                .category("Dresses")
                .styleTags("[\"handcrafted\",\"bohemian\",\"vintage\",\"textured\",\"organic\"]")
                .colorTags("[\"ivory\",\"gold\",\"blush\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product ariaDress2 = productRepository.save(Product.builder()
                .designerProfile(ariaProfile)
                .name("Shibori-Dyed Wrap Dress")
                .description("Each piece is individually dyed using Japanese shibori techniques, resulting in a unique indigo-pattern that cannot be replicated. A true collector's garment.")
                .price(new BigDecimal("185.00"))
                .currency("CAD")
                .category("Dresses")
                .styleTags("[\"handcrafted\",\"organic\",\"textured\",\"vintage\"]")
                .colorTags("[\"navy\",\"ivory\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\",\"XL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        // --- OUTERWEAR: 6 products ---
        Product lunaOuter1 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Minimalist Wool Overcoat")
                .description("A double-faced wool overcoat in deep charcoal. The clean lapels and minimal topstitching speak to Luna Studio's commitment to refined restraint. Fully lined in cupro.")
                .price(new BigDecimal("195.00"))
                .currency("CAD")
                .category("Outerwear")
                .styleTags("[\"structured\",\"tailored\",\"clean-lines\",\"minimal\",\"monochrome\"]")
                .colorTags("[\"charcoal\",\"black\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\",\"XL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product lunaOuter2 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Structured Blazer in Ivory")
                .description("A single-button blazer with sharp padded shoulders and a nipped waist. Cut from a luxurious ivory boucle that adds texture without compromising the clean silhouette.")
                .price(new BigDecimal("178.00"))
                .currency("CAD")
                .category("Outerwear")
                .styleTags("[\"structured\",\"tailored\",\"minimal\",\"clean-lines\"]")
                .colorTags("[\"ivory\",\"cream\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product marcoOuter1 = productRepository.save(Product.builder()
                .designerProfile(marcoProfile)
                .name("VOSS Puffer Jacket")
                .description("An expedition-grade puffer with a reflective VOSS logo panel on the back. Quilted nylon shell, recycled down fill, and a detachable hood. Street-ready for any weather.")
                .price(new BigDecimal("185.00"))
                .currency("CAD")
                .category("Outerwear")
                .styleTags("[\"urban\",\"bold\",\"oversized\",\"graphic\"]")
                .colorTags("[\"black\",\"olive\"]")
                .sizes("[\"S\",\"M\",\"L\",\"XL\",\"XXL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product marcoOuter2 = productRepository.save(Product.builder()
                .designerProfile(marcoProfile)
                .name("Track Jacket in Burgundy")
                .description("A retro-inspired track jacket with contrast side tape and snap-button placket. The rich burgundy colorway gives classic sportswear a fresh, streetwear-ready attitude.")
                .price(new BigDecimal("128.00"))
                .currency("CAD")
                .category("Outerwear")
                .styleTags("[\"urban\",\"bold\",\"casual\",\"graphic\"]")
                .colorTags("[\"burgundy\",\"black\"]")
                .sizes("[\"S\",\"M\",\"L\",\"XL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product ariaOuter1 = productRepository.save(Product.builder()
                .designerProfile(ariaProfile)
                .name("Hand-Knit Chunky Cardigan")
                .description("Hand-knitted from undyed alpaca wool in its natural ecru colour. The open-stitch pattern creates beautiful texture and warmth without weight. A slow-fashion heirloom.")
                .price(new BigDecimal("210.00"))
                .currency("CAD")
                .category("Outerwear")
                .styleTags("[\"handcrafted\",\"textured\",\"organic\",\"bohemian\"]")
                .colorTags("[\"cream\",\"ivory\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product ariaOuter2 = productRepository.save(Product.builder()
                .designerProfile(ariaProfile)
                .name("Felted Wool Poncho")
                .description("Hand-felted from merino wool using wet-felting techniques, this poncho drapes beautifully over any outfit. The irregular edges and natural grey tones make each piece truly one of a kind.")
                .price(new BigDecimal("168.00"))
                .currency("CAD")
                .category("Outerwear")
                .styleTags("[\"handcrafted\",\"organic\",\"textured\",\"bohemian\",\"vintage\"]")
                .colorTags("[\"grey\",\"charcoal\",\"ivory\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\",\"XL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        // --- SHOES: 5 products ---
        Product lunaShoes1 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Minimalist Pointed-Toe Flats")
                .description("A wardrobe essential executed with understated precision. These pointed-toe flats feature a slim leather upper in black with tonal stitching and a low block heel.")
                .price(new BigDecimal("138.00"))
                .currency("CAD")
                .category("Shoes")
                .styleTags("[\"clean-lines\",\"minimal\",\"tailored\"]")
                .colorTags("[\"black\"]")
                .sizes("[\"35\",\"36\",\"37\",\"38\",\"39\",\"40\",\"41\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product marcoShoes1 = productRepository.save(Product.builder()
                .designerProfile(marcoProfile)
                .name("VOSS High-Top Sneakers")
                .description("The cornerstone of the VOSS footwear line. Vulcanized canvas upper, chunky cupsole, and an all-over branding hit at the ankle. In classic black-on-white.")
                .price(new BigDecimal("148.00"))
                .currency("CAD")
                .category("Shoes")
                .styleTags("[\"urban\",\"bold\",\"casual\",\"graphic\"]")
                .colorTags("[\"white\",\"black\"]")
                .sizes("[\"38\",\"39\",\"40\",\"41\",\"42\",\"43\",\"44\",\"45\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product marcoShoes2 = productRepository.save(Product.builder()
                .designerProfile(marcoProfile)
                .name("Slide Sandals — Cobalt")
                .description("Bold cobalt blue EVA slides with a wide branded strap. Lightweight, durable, and unashamedly loud. The summer essential for those who don't do quiet.")
                .price(new BigDecimal("68.00"))
                .currency("CAD")
                .category("Shoes")
                .styleTags("[\"urban\",\"bold\",\"casual\"]")
                .colorTags("[\"cobalt\",\"white\"]")
                .sizes("[\"37\",\"38\",\"39\",\"40\",\"41\",\"42\",\"43\",\"44\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product ariaShoes1 = productRepository.save(Product.builder()
                .designerProfile(ariaProfile)
                .name("Hand-Stitched Leather Sandals")
                .description("Each pair is individually lasted and hand-stitched in a small workshop in Oaxaca. Full-grain leather uppers, adjustable ankle strap, and a natural leather insole that moulds to your foot.")
                .price(new BigDecimal("195.00"))
                .currency("CAD")
                .category("Shoes")
                .styleTags("[\"handcrafted\",\"organic\",\"vintage\",\"bohemian\"]")
                .colorTags("[\"terracotta\",\"gold\"]")
                .sizes("[\"35\",\"36\",\"37\",\"38\",\"39\",\"40\",\"41\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product lunaShoes2 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Sculptural Mule in Ivory")
                .description("An architectural mule with a curved block heel and squared-off toe. The ivory nappa leather upper is panelled with structural topstitching — minimal but unmistakable.")
                .price(new BigDecimal("158.00"))
                .currency("CAD")
                .category("Shoes")
                .styleTags("[\"structured\",\"minimal\",\"clean-lines\",\"tailored\"]")
                .colorTags("[\"ivory\",\"cream\"]")
                .sizes("[\"35\",\"36\",\"37\",\"38\",\"39\",\"40\",\"41\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        // --- ACCESSORIES: 3 products ---
        Product lunaAcc1 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Minimal Leather Belt")
                .description("A 30mm smooth leather belt with a matte gunmetal rectangular buckle. Zero embellishment, maximum impact. Available in black and tan — the belt your wardrobe has been waiting for.")
                .price(new BigDecimal("55.00"))
                .currency("CAD")
                .category("Accessories")
                .styleTags("[\"clean-lines\",\"minimal\",\"structured\"]")
                .colorTags("[\"black\",\"charcoal\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\",\"XL\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product marcoAcc1 = productRepository.save(Product.builder()
                .designerProfile(marcoProfile)
                .name("VOSS Snapback Cap")
                .description("Six-panel structured snapback with embroidered VOSS wordmark on the front panel and woven flag label at the side. Adjustable closure for a universal fit.")
                .price(new BigDecimal("48.00"))
                .currency("CAD")
                .category("Accessories")
                .styleTags("[\"urban\",\"graphic\",\"bold\",\"casual\"]")
                .colorTags("[\"black\",\"white\"]")
                .sizes("[\"ONE SIZE\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product ariaAcc1 = productRepository.save(Product.builder()
                .designerProfile(ariaProfile)
                .name("Macrame Woven Belt")
                .description("Hand-knotted from natural jute cord using traditional macrame techniques. A statement accessory that brings artisanal texture to any outfit. Each knot tied by hand in our studio.")
                .price(new BigDecimal("42.00"))
                .currency("CAD")
                .category("Accessories")
                .styleTags("[\"handcrafted\",\"bohemian\",\"textured\",\"organic\"]")
                .colorTags("[\"ivory\",\"terracotta\"]")
                .sizes("[\"XS\",\"S\",\"M\",\"L\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        // --- BAGS: 1 product ---
        Product lunaBag1 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Structured Top-Handle Bag")
                .description("A compact top-handle bag in smooth black calfskin. Rigid shell construction, suede interior, and a detachable chain strap. The definition of refined minimalism for the modern woman.")
                .price(new BigDecimal("198.00"))
                .currency("CAD")
                .category("Bags")
                .styleTags("[\"structured\",\"minimal\",\"clean-lines\",\"tailored\"]")
                .colorTags("[\"black\"]")
                .sizes("[\"ONE SIZE\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        // --- JEWELRY: 3 products ---
        Product ariaJewel1 = productRepository.save(Product.builder()
                .designerProfile(ariaProfile)
                .name("Hammered Gold Cuff Bracelet")
                .description("Hand-hammered from solid brass and finished with an 18k gold wash, this cuff's irregular surface catches the light in mesmerising ways. A wearable art object by Aria Atelier.")
                .price(new BigDecimal("88.00"))
                .currency("CAD")
                .category("Jewelry")
                .styleTags("[\"handcrafted\",\"bohemian\",\"vintage\",\"organic\"]")
                .colorTags("[\"gold\"]")
                .sizes("[\"ONE SIZE\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product ariaJewel2 = productRepository.save(Product.builder()
                .designerProfile(ariaProfile)
                .name("Clay Bead Necklace — Terracotta")
                .description("Each clay bead is individually hand-rolled and sun-dried before being strung on a waxed linen cord. An earthy talisman necklace that bridges ancient craft and contemporary style.")
                .price(new BigDecimal("52.00"))
                .currency("CAD")
                .category("Jewelry")
                .styleTags("[\"handcrafted\",\"organic\",\"textured\",\"bohemian\"]")
                .colorTags("[\"terracotta\",\"gold\",\"ivory\"]")
                .sizes("[\"ONE SIZE\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        Product lunaJewel1 = productRepository.save(Product.builder()
                .designerProfile(lunaProfile)
                .name("Geometric Silver Earrings")
                .description("Architect-inspired drop earrings in sterling silver with a brushed finish. The interlocking rectangular forms explore negative space with characteristic Luna Studio precision.")
                .price(new BigDecimal("78.00"))
                .currency("CAD")
                .category("Jewelry")
                .styleTags("[\"structured\",\"minimal\",\"clean-lines\",\"monochrome\"]")
                .colorTags("[\"grey\",\"ivory\"]")
                .sizes("[\"ONE SIZE\"]")
                .media(placeholder)
                .glbUrl(GLB_URL)
                .status(ProductStatus.PUBLISHED)
                .build());

        // 5. Create 10 promotions
        Instant now = Instant.now();
        Instant plus7  = now.plus(7,  ChronoUnit.DAYS);
        Instant plus14 = now.plus(14, ChronoUnit.DAYS);
        Instant plus21 = now.plus(21, ChronoUnit.DAYS);
        Instant plus28 = now.plus(28, ChronoUnit.DAYS);

        // 6 FEATURED (homepage carousel) with weights 10-60
        promotionRepository.save(Promotion.builder()
                .product(lunaTop1)
                .slotType(SlotType.FEATURED)
                .weight(60)
                .startAt(now)
                .endAt(plus28)
                .build());

        promotionRepository.save(Promotion.builder()
                .product(lunaOuter1)
                .slotType(SlotType.FEATURED)
                .weight(50)
                .startAt(now)
                .endAt(plus21)
                .build());

        promotionRepository.save(Promotion.builder()
                .product(marcoTop1)
                .slotType(SlotType.FEATURED)
                .weight(40)
                .startAt(now)
                .endAt(plus28)
                .build());

        promotionRepository.save(Promotion.builder()
                .product(marcoOuter1)
                .slotType(SlotType.FEATURED)
                .weight(30)
                .startAt(now)
                .endAt(plus14)
                .build());

        promotionRepository.save(Promotion.builder()
                .product(ariaDress1)
                .slotType(SlotType.FEATURED)
                .weight(20)
                .startAt(now)
                .endAt(plus21)
                .build());

        promotionRepository.save(Promotion.builder()
                .product(ariaOuter1)
                .slotType(SlotType.FEATURED)
                .weight(10)
                .startAt(now)
                .endAt(plus7)
                .build());

        // 4 SPONSORED (in-feed) with weights 1-4
        promotionRepository.save(Promotion.builder()
                .product(lunaBag1)
                .slotType(SlotType.SPONSORED)
                .weight(4)
                .startAt(now)
                .endAt(plus28)
                .build());

        promotionRepository.save(Promotion.builder()
                .product(lunaShoes1)
                .slotType(SlotType.SPONSORED)
                .weight(3)
                .startAt(now)
                .endAt(plus14)
                .build());

        promotionRepository.save(Promotion.builder()
                .product(ariaJewel1)
                .slotType(SlotType.SPONSORED)
                .weight(2)
                .startAt(now)
                .endAt(plus21)
                .build());

        promotionRepository.save(Promotion.builder()
                .product(marcoShoes1)
                .slotType(SlotType.SPONSORED)
                .weight(1)
                .startAt(now)
                .endAt(plus7)
                .build());

        // 6. Create garment assets for ALL 36 products
        List<Product> allProducts = List.of(
                lunaTop1, lunaTop2, lunaTop3, marcoTop1, marcoTop2, ariaTop1, ariaTop2,
                lunaBottom1, lunaBottom2, marcoBottom1, marcoBottom2, ariaBottom1, ariaBottom2, lunaBottom3,
                lunaDress1, marcoDress1, ariaDress1, ariaDress2,
                lunaOuter1, lunaOuter2, marcoOuter1, marcoOuter2, ariaOuter1, ariaOuter2,
                lunaShoes1, marcoShoes1, marcoShoes2, ariaShoes1, lunaShoes2,
                lunaAcc1, marcoAcc1, ariaAcc1,
                lunaBag1,
                ariaJewel1, ariaJewel2, lunaJewel1
        );

        for (Product product : allProducts) {
            garmentAssetRepository.save(GarmentAsset.builder()
                    .product(product)
                    .glbUrl(GLB_URL)
                    .slotHint(slotHintFromCategory(product.getCategory()))
                    .status("READY")
                    .build());
        }

        log.info("DataSeeder: complete — 5 users, 3 designer profiles, 2 body profiles, 36 PUBLISHED products (all with GLB), 10 promotions, 36 garment assets created.");
    }

    private static GarmentSlotHint slotHintFromCategory(String category) {
        return switch (category) {
            case "Tops", "Outerwear", "Dresses" -> GarmentSlotHint.TOP;
            case "Bottoms" -> GarmentSlotHint.BOTTOM;
            case "Shoes" -> GarmentSlotHint.SHOES;
            default -> GarmentSlotHint.ACCESSORY; // Accessories, Bags, Jewelry
        };
    }
}
