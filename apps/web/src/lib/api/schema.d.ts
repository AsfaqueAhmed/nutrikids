/**
 * NutriKids OpenAPI TypeScript Contract (Phase 1)
 */

export interface paths {
  '/v1/auth/register': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            email: string;
            password: string;
          };
        };
      };
      responses: {
        201: {
          content: {
            'application/json': {
              accessToken: string;
              refreshToken: string;
              user: {
                id: string;
                email: string;
                role: string;
                emailVerified: boolean;
                timezone: string;
              };
            };
          };
        };
        400: { content: { 'application/json': components['schemas']['ApiError'] } };
        409: { content: { 'application/json': components['schemas']['ApiError'] } };
      };
    };
  };
  '/v1/auth/login': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            email: string;
            password: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              accessToken: string;
              refreshToken: string;
              user: {
                id: string;
                email: string;
                role: string;
                emailVerified: boolean;
                timezone: string;
              };
            };
          };
        };
        401: { content: { 'application/json': components['schemas']['ApiError'] } };
      };
    };
  };
  '/v1/auth/refresh': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            refreshToken: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              accessToken: string;
              refreshToken: string;
            };
          };
        };
        401: { content: { 'application/json': components['schemas']['ApiError'] } };
      };
    };
  };
  '/v1/auth/logout': {
    post: {
      requestBody?: {
        content: {
          'application/json': {
            refreshToken?: string;
          };
        };
      };
      responses: {
        200: { content: { 'application/json': { success: boolean } } };
      };
    };
  };
  '/v1/auth/verify-email': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            token: string;
          };
        };
      };
      responses: {
        200: { content: { 'application/json': { success: boolean } } };
        400: { content: { 'application/json': components['schemas']['ApiError'] } };
      };
    };
  };
  '/v1/auth/forgot-password': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            email: string;
          };
        };
      };
      responses: {
        200: { content: { 'application/json': { success: boolean; message: string } } };
      };
    };
  };
  '/v1/auth/reset-password': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            token: string;
            password: string;
          };
        };
      };
      responses: {
        200: { content: { 'application/json': { success: boolean } } };
        400: { content: { 'application/json': components['schemas']['ApiError'] } };
      };
    };
  };
  '/v1/auth/social': {
    post: {
      requestBody: {
        content: {
          'application/json': {
            provider: 'google' | 'apple';
            idToken: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': {
              accessToken: string;
              refreshToken: string;
              user: components['schemas']['User'];
            };
          };
        };
      };
    };
  };
  '/v1/me': {
    get: {
      responses: {
        200: { content: { 'application/json': components['schemas']['User'] } };
        401: { content: { 'application/json': components['schemas']['ApiError'] } };
      };
    };
    patch: {
      requestBody: {
        content: {
          'application/json': Partial<components['schemas']['User']>;
        };
      };
      responses: {
        200: { content: { 'application/json': components['schemas']['User'] } };
      };
    };
  };
  '/v1/children': {
    get: {
      responses: {
        200: { content: { 'application/json': components['schemas']['Child'][] } };
        401: { content: { 'application/json': components['schemas']['ApiError'] } };
      };
    };
    post: {
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateChildDto'];
        };
      };
      responses: {
        201: { content: { 'application/json': components['schemas']['Child'] } };
        400: { content: { 'application/json': components['schemas']['ApiError'] } };
        401: { content: { 'application/json': components['schemas']['ApiError'] } };
      };
    };
  };
  '/v1/children/{id}': {
    get: {
      parameters: { path: { id: string } };
      responses: {
        200: { content: { 'application/json': components['schemas']['Child'] } };
        404: { content: { 'application/json': components['schemas']['ApiError'] } };
      };
    };
    put: {
      parameters: { path: { id: string } };
      requestBody: {
        content: {
          'application/json': Partial<components['schemas']['CreateChildDto']>;
        };
      };
      responses: {
        200: { content: { 'application/json': components['schemas']['Child'] } };
        400: { content: { 'application/json': components['schemas']['ApiError'] } };
        404: { content: { 'application/json': components['schemas']['ApiError'] } };
      };
    };
    delete: {
      parameters: { path: { id: string } };
      responses: {
        204: { content: never };
        404: { content: { 'application/json': components['schemas']['ApiError'] } };
      };
    };
  };
  '/v1/children/{id}/allergies': {
    get: {
      parameters: { path: { id: string } };
      responses: {
        200: { content: { 'application/json': components['schemas']['ChildAllergy'][] } };
      };
    };
    post: {
      parameters: { path: { id: string } };
      requestBody: {
        content: {
          'application/json': {
            allergenTag: string;
            severity: 'mild' | 'moderate' | 'severe';
          };
        };
      };
      responses: {
        201: { content: { 'application/json': components['schemas']['ChildAllergy'] } };
      };
    };
  };
  '/v1/children/{id}/allergies/{allergyId}': {
    delete: {
      parameters: { path: { id: string; allergyId: string } };
      responses: {
        204: { content: never };
      };
    };
  };
  '/v1/children/{id}/feeding-logs': {
    get: {
      parameters: { path: { id: string }; query?: { date?: string } };
      responses: {
        200: { content: { 'application/json': components['schemas']['FeedingLog'][] } };
      };
    };
    post: {
      parameters: { path: { id: string } };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateFeedingLogDto'];
        };
      };
      responses: {
        201: { content: { 'application/json': components['schemas']['FeedingLog'] } };
      };
    };
  };
  '/v1/children/{id}/feeding-logs/{logId}': {
    put: {
      parameters: { path: { id: string; logId: string } };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateFeedingLogDto'] & { clientUpdatedAt: string };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': components['schemas']['FeedingLog'] & {
              sync?: { superseded: boolean };
            };
          };
        };
      };
    };
  };
  '/v1/children/{id}/food-introductions': {
    get: {
      parameters: { path: { id: string } };
      responses: {
        200: { content: { 'application/json': components['schemas']['FoodIntroduction'][] } };
      };
    };
    post: {
      parameters: { path: { id: string } };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateFoodIntroductionDto'];
        };
      };
      responses: {
        201: { content: { 'application/json': components['schemas']['FoodIntroduction'] } };
      };
    };
  };
  '/v1/children/{id}/meal-plans': {
    get: {
      parameters: { path: { id: string }; query?: { startDate?: string; endDate?: string } };
      responses: {
        200: { content: { 'application/json': components['schemas']['MealPlan'][] } };
      };
    };
    post: {
      parameters: { path: { id: string } };
      requestBody: {
        content: {
          'application/json': {
            startDate: string;
            days?: number;
          };
        };
      };
      responses: {
        201: { content: { 'application/json': components['schemas']['MealPlan'] } };
        409: { content: { 'application/json': components['schemas']['ApiError'] } };
      };
    };
  };
  '/v1/children/{id}/meal-plans/{planId}/entries/{entryId}': {
    put: {
      parameters: { path: { id: string; planId: string; entryId: string } };
      requestBody: {
        content: {
          'application/json': {
            recipeId: string;
            portion?: number;
            confirmAllergen?: boolean;
            clientUpdatedAt?: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': components['schemas']['MealPlanEntry'] & {
              sync?: { superseded: boolean };
            };
          };
        };
        409: { content: { 'application/json': components['schemas']['ApiError'] } };
      };
    };
  };
  '/v1/children/{id}/meal-plans/{planId}/grocery': {
    get: {
      parameters: { path: { id: string; planId: string } };
      responses: {
        200: { content: { 'application/json': components['schemas']['GroceryItem'][] } };
      };
    };
  };
  '/v1/children/{id}/meal-plans/{planId}/grocery/{itemId}': {
    put: {
      parameters: { path: { id: string; planId: string; itemId: string } };
      requestBody: {
        content: {
          'application/json': {
            checked: boolean;
            clientUpdatedAt: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': components['schemas']['GroceryItem'] & {
              sync?: { superseded: boolean };
            };
          };
        };
      };
    };
  };
  '/v1/children/{id}/growth-records': {
    get: {
      parameters: { path: { id: string } };
      responses: {
        200: {
          content: {
            'application/json': {
              records: components['schemas']['GrowthRecord'][];
              provisional: boolean;
            };
          };
        };
      };
    };
    post: {
      parameters: { path: { id: string } };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateGrowthRecordDto'];
        };
      };
      responses: {
        201: { content: { 'application/json': components['schemas']['GrowthRecord'] } };
      };
    };
  };
  '/v1/children/{id}/growth-records/{recordId}': {
    put: {
      parameters: { path: { id: string; recordId: string } };
      requestBody: {
        content: {
          'application/json': components['schemas']['CreateGrowthRecordDto'] & {
            clientUpdatedAt: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': components['schemas']['GrowthRecord'] & {
              sync?: { superseded: boolean };
            };
          };
        };
      };
    };
  };
  '/v1/children/{id}/growth-records/percentiles': {
    get: {
      parameters: { path: { id: string }; query?: { metric?: string } };
      responses: {
        200: {
          content: {
            'application/json': components['schemas']['GrowthPercentileResponse'];
          };
        };
      };
    };
  };
  '/v1/children/{id}/nutrition/daily': {
    get: {
      parameters: { path: { id: string }; query?: { date?: string } };
      responses: {
        200: {
          content: {
            'application/json': components['schemas']['DailyNutritionResponse'];
          };
        };
      };
    };
  };
  '/v1/vaccines': {
    get: {
      responses: {
        200: { content: { 'application/json': components['schemas']['Vaccine'][] } };
      };
    };
  };
  '/v1/children/{id}/vaccinations': {
    get: {
      parameters: { path: { id: string } };
      responses: {
        200: { content: { 'application/json': components['schemas']['ChildVaccination'][] } };
      };
    };
  };
  '/v1/children/{id}/vaccinations/{vaccinationId}': {
    put: {
      parameters: { path: { id: string; vaccinationId: string } };
      requestBody: {
        content: {
          'application/json': {
            givenDate?: string | null;
            facilityName?: string;
            paidType?: string;
            amountPaidBdt?: number;
            notes?: string;
            clientUpdatedAt: string;
          };
        };
      };
      responses: {
        200: {
          content: {
            'application/json': components['schemas']['ChildVaccination'] & {
              sync?: { superseded: boolean };
            };
          };
        };
      };
    };
  };
  '/v1/hospitals/nearby': {
    get: {
      parameters: {
        query: {
          lat: number;
          lng: number;
          radiusKm?: number;
          service?: string;
        };
      };
      responses: {
        200: { content: { 'application/json': components['schemas']['Hospital'][] } };
      };
    };
  };
  '/v1/notifications/preferences': {
    get: {
      responses: {
        200: { content: { 'application/json': components['schemas']['NotificationPreference'][] } };
      };
    };
    put: {
      requestBody: {
        content: {
          'application/json': {
            preferences: components['schemas']['NotificationPreference'][];
          };
        };
      };
      responses: {
        200: { content: { 'application/json': { success: boolean } } };
      };
    };
  };
  '/v1/children/{id}/meal-reminders': {
    get: {
      parameters: { path: { id: string } };
      responses: {
        200: { content: { 'application/json': components['schemas']['MealReminder'][] } };
      };
    };
    put: {
      parameters: { path: { id: string } };
      requestBody: {
        content: {
          'application/json': {
            reminders: components['schemas']['MealReminder'][];
          };
        };
      };
      responses: {
        200: { content: { 'application/json': { success: boolean } } };
      };
    };
  };
  '/v1/foods': {
    get: {
      parameters: { query?: { search?: string; category?: string } };
      responses: {
        200: { content: { 'application/json': components['schemas']['Food'][] } };
      };
    };
  };
}

export interface components {
  schemas: {
    ApiError: {
      code: string;
      message: string;
      details?: unknown;
    };
    User: {
      id: string;
      email: string;
      role: string;
      emailVerified: boolean;
      timezone: string;
      privacyAnalyticsOptIn?: boolean;
    };
    Child: {
      id: string;
      userId: string;
      name: string;
      dateOfBirth: string;
      gender: 'male' | 'female' | 'other';
      heightCm: number;
      weightKg: number;
      activityLevel: 'sedentary' | 'moderate' | 'active';
      dietType: string;
      photoUrl?: string;
      createdAt: string;
      updatedAt: string;
    };
    CreateChildDto: {
      name: string;
      dateOfBirth: string;
      gender: 'male' | 'female' | 'other';
      heightCm: number;
      weightKg: number;
      activityLevel: 'sedentary' | 'moderate' | 'active';
      dietType: string;
      photoUrl?: string;
    };
    ChildAllergy: {
      id: string;
      childId: string;
      allergenTag: string;
      severity: 'mild' | 'moderate' | 'severe';
    };
    Food: {
      id: string;
      name: string;
      category: string;
      allergenTags: string[];
      ageMinMonths: number;
      ageMaxMonths: number;
    };
    Recipe: {
      id: string;
      name: string;
      instructions: string;
      prepMinutes: number;
      ageMinMonths: number;
      ageMaxMonths: number;
      allergenTags: string[];
    };
    MealPlanEntry: {
      id: string;
      planId: string;
      date: string;
      slot: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner';
      recipeId: string;
      recipe: components['schemas']['Recipe'];
      portion: number;
      createdBy: string;
    };
    MealPlan: {
      id: string;
      childId: string;
      startDate: string;
      endDate: string;
      type: string;
      entries: components['schemas']['MealPlanEntry'][];
    };
    GroceryItem: {
      id: string;
      planId: string;
      foodId: string;
      foodName: string;
      category: string;
      quantity: number;
      unit: string;
      checked: boolean;
    };
    GrowthRecord: {
      id: string;
      childId: string;
      date: string;
      heightCm: number;
      weightKg: number;
      headCircumferenceCm?: number;
      percentiles?: {
        heightZ?: number;
        weightZ?: number;
        bmiZ?: number;
        status?: string;
      };
      provisional?: boolean;
    };
    CreateGrowthRecordDto: {
      date: string;
      heightCm: number;
      weightKg: number;
      headCircumferenceCm?: number;
    };
    GrowthPercentileResponse: {
      points: {
        ageMonths: number;
        childValue: number;
        p3: number;
        p15: number;
        p50: number;
        p85: number;
        p97: number;
      }[];
      metric: string;
      provisional: boolean;
    };
    DailyNutritionResponse: {
      date: string;
      score: number;
      provisional: boolean;
      nutrients: {
        name: string;
        current: number;
        target: number;
        unit: string;
        percentage: number;
        status: 'low' | 'good' | 'excess';
      }[];
      tips: string[];
    };
    FeedingLog: {
      id: string;
      childId: string;
      type: 'breast' | 'formula' | 'solid';
      at: string;
      durationMinutes?: number;
      notes?: string;
    };
    CreateFeedingLogDto: {
      type: 'breast' | 'formula' | 'solid';
      at: string;
      durationMinutes?: number;
      notes?: string;
    };
    FoodIntroduction: {
      id: string;
      childId: string;
      foodId: string;
      foodName: string;
      introducedOn: string;
      reaction: 'none' | 'mild' | 'severe';
      notes?: string;
    };
    CreateFoodIntroductionDto: {
      foodId: string;
      foodName: string;
      introducedOn: string;
      reaction: 'none' | 'mild' | 'severe';
      notes?: string;
    };
    Vaccine: {
      id: string;
      code: string;
      name: string;
      disease: string;
      description: string;
      availability: 'GOVERNMENT_FREE' | 'PRIVATE_PAID' | 'BOTH';
      isMandatory: boolean;
      priceMinBdt?: number;
      priceMaxBdt?: number;
      priceNote?: string;
      priceUpdatedAt?: string;
    };
    ChildVaccination: {
      id: string;
      childId: string;
      vaccineId: string;
      vaccine: components['schemas']['Vaccine'];
      doseNumber: number;
      dueDate: string;
      givenDate?: string | null;
      status: 'upcoming' | 'due' | 'overdue' | 'given' | 'given_late';
      facilityName?: string;
      paidType?: string;
      amountPaidBdt?: number;
      notes?: string;
    };
    Hospital: {
      id: string;
      name: string;
      type: string;
      address: string;
      district: string;
      lat: number;
      lng: number;
      phone?: string;
      emergencyPhone?: string;
      distanceKm?: number;
      services: string[];
      verifiedAt?: string;
    };
    NotificationPreference: {
      type: string;
      enabled: boolean;
      time?: string;
    };
    MealReminder: {
      slot: 'breakfast' | 'morning_snack' | 'lunch' | 'afternoon_snack' | 'dinner';
      timeOfDay: string;
      enabled: boolean;
    };
  };
}
