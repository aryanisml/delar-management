/**
 * Tool definitions for LLM function calling
 * These tools enable the chatbot to search customers, vehicles, and manage bookings
 */

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

export const CHATBOT_TOOLS: ToolDefinition[] = [
  {
    name: 'search_customers',
    description:
      'Search for customers by name, email, or phone number. Useful when user wants to find customer details or history.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query - customer name, email, or phone number',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_vehicles',
    description:
      'Search for available vehicles by brand, model, location, or vehicle type. Useful for finding cars to recommend.',
    parameters: {
      type: 'object',
      properties: {
        brand: {
          type: 'string',
          description: 'Vehicle brand/manufacturer name',
        },
        model: {
          type: 'string',
          description: 'Vehicle model name',
        },
        location: {
          type: 'string',
          description: 'Pickup location',
        },
        min_price: {
          type: 'number',
          description: 'Minimum daily rate',
        },
        max_price: {
          type: 'number',
          description: 'Maximum daily rate',
        },
        vehicle_type: {
          type: 'string',
          enum: ['sedan', 'suv', 'hatchback', 'van', 'truck', 'premium'],
          description: 'Type of vehicle',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
      required: ['brand'],
    },
  },
  {
    name: 'get_vehicle_details',
    description: 'Get detailed information about a specific vehicle by ID',
    parameters: {
      type: 'object',
      properties: {
        vehicle_id: {
          type: 'string',
          description: 'The unique identifier of the vehicle',
        },
      },
      required: ['vehicle_id'],
    },
  },
  {
    name: 'get_customer_details',
    description: 'Get detailed information about a specific customer by ID or email',
    parameters: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'string',
          description: 'The unique identifier of the customer (optional if email provided)',
        },
        email: {
          type: 'string',
          description: 'Customer email address (optional if customer_id provided)',
        },
      },
      required: [],
    },
  },
  {
    name: 'check_availability',
    description: 'Check if a vehicle is available for specific dates',
    parameters: {
      type: 'object',
      properties: {
        vehicle_id: {
          type: 'string',
          description: 'The vehicle ID to check',
        },
        start_date: {
          type: 'string',
          description: 'Booking start date (YYYY-MM-DD format)',
        },
        end_date: {
          type: 'string',
          description: 'Booking end date (YYYY-MM-DD format)',
        },
      },
      required: ['vehicle_id', 'start_date', 'end_date'],
    },
  },
  {
    name: 'create_booking',
    description: 'Create a new booking for a customer with a vehicle',
    parameters: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'string',
          description: 'The customer ID for the booking',
        },
        vehicle_id: {
          type: 'string',
          description: 'The vehicle ID to book',
        },
        start_date: {
          type: 'string',
          description: 'Booking start date (YYYY-MM-DD format)',
        },
        end_date: {
          type: 'string',
          description: 'Booking end date (YYYY-MM-DD format)',
        },
        pickup_location: {
          type: 'string',
          description: 'Pickup location',
        },
        dropoff_location: {
          type: 'string',
          description: 'Drop-off location',
        },
        special_requests: {
          type: 'string',
          description: 'Any special requests from the customer',
        },
      },
      required: ['customer_id', 'vehicle_id', 'start_date', 'end_date', 'pickup_location'],
    },
  },
  {
    name: 'get_booking_status',
    description: 'Get the status and details of a specific booking',
    parameters: {
      type: 'object',
      properties: {
        booking_id: {
          type: 'string',
          description: 'The booking ID to check',
        },
      },
      required: ['booking_id'],
    },
  },
  {
    name: 'calculate_booking_price',
    description:
      'Calculate the total price for a booking including taxes and discounts',
    parameters: {
      type: 'object',
      properties: {
        vehicle_id: {
          type: 'string',
          description: 'The vehicle ID',
        },
        start_date: {
          type: 'string',
          description: 'Booking start date (YYYY-MM-DD format)',
        },
        end_date: {
          type: 'string',
          description: 'Booking end date (YYYY-MM-DD format)',
        },
        promo_code: {
          type: 'string',
          description: 'Optional promo code for discounts',
        },
      },
      required: ['vehicle_id', 'start_date', 'end_date'],
    },
  },
  {
    name: 'get_customer_bookings',
    description: 'Get all bookings for a specific customer',
    parameters: {
      type: 'object',
      properties: {
        customer_id: {
          type: 'string',
          description: 'The customer ID',
        },
        status: {
          type: 'string',
          enum: ['pending', 'confirmed', 'completed', 'cancelled'],
          description: 'Filter bookings by status (optional)',
        },
      },
      required: ['customer_id'],
    },
  },
];

export type ToolName = typeof CHATBOT_TOOLS[number]['name'];
