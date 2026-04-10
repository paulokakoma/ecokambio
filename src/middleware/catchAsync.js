/**
 * Envolve uma função de controlador assíncrona do Express para capturar quaisquer erros
 * e passá-los para o middleware de erro global através de next().
 * @param {Function} fn A função de controlador de rota assíncrona.
 * @returns {Function} Uma nova função que executa o controlador e captura os erros.
 */
const catchAsync = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;