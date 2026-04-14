const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const supabase = require('../src/config/supabase');

async function deleteAllProducts() {
    console.log('🚮 A iniciar remoção de todos os produtos (Mocks) da base de dados...');
    
    try {
        // Obter todos os produtos
        const { data: products, error: fetchError } = await supabase
            .from('products')
            .select('id');
            
        if (fetchError) throw fetchError;
        
        if (!products || products.length === 0) {
            console.log('✅ Nenhum produto encontrado na base de dados.');
            process.exit(0);
        }
        
        console.log(`Encontrados ${products.length} produtos. A apagar...`);
        
        // Apagar os produtos pelo ID
        const ids = products.map(p => p.id);
        const { error: deleteError } = await supabase
            .from('products')
            .delete()
            .in('id', ids);
            
        if (deleteError) throw deleteError;
        
        console.log('✅ Todos os produtos de teste foram removidos com sucesso da base de dados!');
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

deleteAllProducts();
