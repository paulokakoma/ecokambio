const supabase = require("../config/supabase");
const { handleSupabaseError } = require("../middleware/errorHandler");
const sharp = require("sharp");
const path = require("path");

// PUBLIC API: Return products shaped exactly like the old products.json format
const getPublicProductsJson = async (req, res) => {
    try {
        let data, error;

        // Try with product_images join first; fall back if table doesn't exist yet
        const resultWithImages = await supabase
            .from('products')
            .select('*, product_images(*)')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (resultWithImages.error && resultWithImages.error.code === 'PGRST200') {
            // product_images table not yet created — use simple query
            const fallback = await supabase
                .from('products')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });
            data = fallback.data;
            error = fallback.error;
        } else {
            data = resultWithImages.data;
            error = resultWithImages.error;
        }

        if (error) throw error;

        const formattedData = {};
        data.forEach(product => {
            const images = (product.product_images || []).sort((a, b) => a.sort_order - b.sort_order);
            const primaryImg = images.find(i => i.is_primary)?.url || images[0]?.url || product.img_url || null;

            formattedData[product.slug] = {
                name: product.name,
                category: product.category,
                badgeClass: product.badge_class || getDefaultBadge(product.category),
                price: product.price,
                oldPrice: product.old_price,
                img: primaryImg,
                images: images.map(i => i.url),
                description: product.description
            };
        });

        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });

        res.status(200).json(formattedData);
    } catch (error) {
        console.error("Erro ao buscar produtos publicos:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

// ADMIN API: Get all products with their images
const getAdminProducts = async (req, res) => {
    try {
        // Try with join; fallback if table doesn't exist
        const resultWithImages = await supabase
            .from('products')
            .select('*, product_images(*)')
            .order('created_at', { ascending: false });

        let data, error;
        if (resultWithImages.error && resultWithImages.error.code === 'PGRST200') {
            const fallback = await supabase.from('products').select('*').order('created_at', { ascending: false });
            data = fallback.data;
            error = fallback.error;
        } else {
            data = resultWithImages.data;
            error = resultWithImages.error;
        }

        if (error) throw error;
        res.status(200).json(data);
    } catch (error) {
        handleSupabaseError(error, res);
    }
};

// ADMIN API: Create Product
const createProduct = async (req, res) => {
    try {
        const productData = extractProductData(req.body);

        // Legacy single-image support (still works)
        if (req.file) {
            const newImageUrl = await parseAndUploadImage(req.file);
            productData.img_url = newImageUrl;
        }

        const { data, error } = await supabase
            .from('products')
            .insert([productData])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(400).json({ message: "Já existe um produto com este slug/ID." });
            }
            throw error;
        }

        res.status(201).json({ success: true, data });
    } catch (error) {
        console.error("Erro ao criar produto:", error);
        handleSupabaseError(error, res);
    }
};

// ADMIN API: Update Product
const updateProduct = async (req, res) => {
    const { id } = req.params;
    try {
        const productData = extractProductData(req.body);

        if (req.file) {
            const newImageUrl = await parseAndUploadImage(req.file);
            productData.img_url = newImageUrl;
        }

        const { data, error } = await supabase
            .from('products')
            .update(productData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return res.status(409).json({ message: "Já existe um produto com este slug/nome." });
            }
            throw error;
        }

        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("Erro ao atualizar produto:", error);
        handleSupabaseError(error, res);
    }
};

// ADMIN API: Delete Product
const deleteProduct = async (req, res) => {
    const { id } = req.params;
    try {
        // Obter as imagens primeiro para garantir
        const { data: images } = await supabase.from('product_images').select('id, url').eq('product_id', id);
        
        // 1. Apagar registos de imagens associadas (prevenir erro de Foreign Key Violation)
        if (images && images.length > 0) {
            await supabase.from('product_images').delete().eq('product_id', id);
            
            // Opcional: Remover os ficheiros do bucket 'site-assets'
            // const urls = images.map(img => img.url.split('/').pop()).filter(Boolean);
            // if (urls.length > 0) {
            //     await supabase.storage.from('site-assets').remove(urls);
            // }
        }

        // 2. Apagar o produto na tabela principal
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) {
            console.error("Erro do Supabase ao apagar produto:", error);
            throw error;
        }
            
        res.status(200).json({ success: true, message: "Produto apagado com sucesso." });
    } catch (error) {
        console.error("Erro na API de apagar produto:", error);
        handleSupabaseError(error, res);
    }
};

// ADMIN API: Upload a single image for a product (incremental)
const uploadProductImage = async (req, res) => {
    const { id } = req.params;
    try {
        if (!req.file) {
            return res.status(400).json({ message: "Nenhuma imagem enviada." });
        }

        // Count existing images
        const { count } = await supabase
            .from('product_images')
            .select('id', { count: 'exact', head: true })
            .eq('product_id', id);

        const isFirst = !count;  // null or 0 both mean no existing images
        const imageUrl = await parseAndUploadImage(req.file);

        // Insert into product_images
        const { data: imgData, error: imgError } = await supabase
            .from('product_images')
            .insert([{
                product_id: id,
                url: imageUrl,
                is_primary: isFirst, // first image is primary by default
                sort_order: count || 0
            }])
            .select()
            .single();

        if (imgError) throw imgError;

        // If first image, also update legacy img_url for backward compat
        if (isFirst) {
            await supabase.from('products').update({ img_url: imageUrl }).eq('id', id);
        }

        res.status(201).json({ success: true, data: imgData });
    } catch (error) {
        console.error("Erro ao fazer upload de imagem:", error);
        handleSupabaseError(error, res);
    }
};

// ADMIN API: Delete a product image
const deleteProductImage = async (req, res) => {
    const { imageId } = req.params;
    try {
        // Get the image info before deleting
        const { data: img, error: fetchErr } = await supabase
            .from('product_images')
            .select('*')
            .eq('id', imageId)
            .single();

        if (fetchErr) throw fetchErr;

        const { error } = await supabase.from('product_images').delete().eq('id', imageId);
        if (error) throw error;

        // If deleted was primary, promote the next image
        if (img.is_primary) {
            const { data: remaining } = await supabase
                .from('product_images')
                .select('id, url')
                .eq('product_id', img.product_id)
                .order('sort_order')
                .limit(1);

            if (remaining && remaining.length > 0) {
                await supabase.from('product_images').update({ is_primary: true }).eq('id', remaining[0].id);
                await supabase.from('products').update({ img_url: remaining[0].url }).eq('id', img.product_id);
            } else {
                // No more images, clear legacy img_url
                await supabase.from('products').update({ img_url: null }).eq('id', img.product_id);
            }
        }

        res.status(200).json({ success: true, message: "Imagem apagada com sucesso." });
    } catch (error) {
        console.error("Erro ao apagar imagem:", error);
        handleSupabaseError(error, res);
    }
};

// ADMIN API: Set image as primary
const setPrimaryImage = async (req, res) => {
    const { imageId } = req.params;
    try {
        const { data: img } = await supabase.from('product_images').select('*').eq('id', imageId).single();
        if (!img) return res.status(404).json({ message: "Imagem não encontrada." });

        // Unset all primary for this product
        await supabase.from('product_images').update({ is_primary: false }).eq('product_id', img.product_id);
        // Set this one as primary
        await supabase.from('product_images').update({ is_primary: true }).eq('id', imageId);
        // Also update legacy img_url
        await supabase.from('products').update({ img_url: img.url }).eq('id', img.product_id);

        res.status(200).json({ success: true, message: "Imagem principal definida." });
    } catch (error) {
        handleSupabaseError(error, res);
    }
};

// Helper: Extract valid data from body
const extractProductData = (body) => {
    let { slug, name, category, badge_class, price, old_price, description, is_active } = body;
    
    const data = {};

    if (name !== undefined) data.name = String(name).trim();
    if (category !== undefined) data.category = category;
    if (price !== undefined) data.price = price;
    if (description !== undefined) data.description = description;
    if (badge_class !== undefined) data.badge_class = badge_class || null;
    if (old_price !== undefined) data.old_price = old_price;
    if (is_active !== undefined) data.is_active = (is_active === 'true' || is_active === true);

    // Auto-gerar o slug se enviarmos o nome ou o slug explicitamente
    if (slug !== undefined || name !== undefined) {
        let safeSlug = slug ? String(slug).trim() : '';
        let safeName = data.name || '';

        if (!safeSlug && safeName) {
            data.slug = safeName.toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^a-z0-9]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        } else if (safeSlug) {
            data.slug = safeSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        }
        // Se slug resultou em string vazia após processamento, remover do data para evitar erro de constraint
        if (data.slug === '') {
            delete data.slug;
        }
    }

    
    return data;
};

// Helper: Get default badge based on category
const getDefaultBadge = (category) => {
    const defaultBadges = {
        "Eletrónicos": "badge-eletronicos",
        "Computadores": "badge-computadores",
        "Televisores": "badge-televisores",
        "Eletrodomésticos": "badge-eletrodomesticos",
        "Telemóveis": "badge-telemoveis"
    };
    return defaultBadges[category] || "bg-slate-600 text-white";
};

// Helper: Process and upload image to Supabase Storage
const parseAndUploadImage = async (file) => {
    const optimizedBuffer = await sharp(file.buffer)
        .resize({ width: 1000, height: 1000, fit: 'inside' })
        .webp({ quality: 85 })
        .toBuffer();

    const originalNameWithoutExt = path.parse(file.originalname).name;
    const sanitizedOriginalName = originalNameWithoutExt
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, '_');

    const fileName = `product-${Date.now()}-${sanitizedOriginalName}.webp`;

    const { error: uploadError } = await supabase.storage.from('site-assets')
        .upload(fileName, optimizedBuffer, {
            contentType: 'image/webp',
            upsert: true,
        });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from('site-assets').getPublicUrl(fileName);
    if (!urlData?.publicUrl) throw new Error('Não foi possível obter o URL público do arquivo');

    return urlData.publicUrl;
};

module.exports = {
    getPublicProductsJson,
    getAdminProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    uploadProductImage,
    deleteProductImage,
    setPrimaryImage
};
