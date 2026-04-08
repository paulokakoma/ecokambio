const { settingsRepository } = require('../repositories');
const logger = require('../config/logger');

/**
 * Settings Service
 * Contém a lógica de negócio para configurações
 */
class SettingsService {
    /**
     * Buscar configurações
     */
    async getSettings() {
        try {
            const settings = await settingsRepository.findActive();
            return settings || {};
        } catch (error) {
            logger.error('Erro ao buscar configurações:', error);
            throw error;
        }
    }

    /**
     * Atualizar configurações
     */
    async updateSettings(data) {
        try {
            const existing = await settingsRepository.findActive();

            if (existing) {
                return await settingsRepository.update(existing.id, data);
            } else {
                return await settingsRepository.create({
                    ...data,
                    is_active: true,
                    created_at: new Date().toISOString()
                });
            }
        } catch (error) {
            logger.error('Erro ao atualizar configurações:', error);
            throw error;
        }
    }

    /**
     * Atualizar configurações de VISA
     */
    async updateVisaSettings(visaData) {
        try {
            const settings = await this.getSettings();
            return await this.updateSettings({
                ...settings,
                ...visaData
            });
        } catch (error) {
            logger.error('Erro ao atualizar configurações VISA:', error);
            throw error;
        }
    }
}

module.exports = new SettingsService();
