import swaggerJsDoc from 'swagger-jsdoc';

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Stockinfo-api-doc',
      version: '1.0.0',
      description: 'API documentation',
      contact: {
        name: 'API Support',
        email: 'rightmajay@gmail.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url:
          process.env.API_URL || 'https://93ba-122-176-44-176.ngrok-free.app',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./app/routes/*.js'],
};

export const swaggerDocs = swaggerJsDoc(swaggerOptions);
