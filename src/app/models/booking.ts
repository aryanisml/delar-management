export interface Booking {

id?: string;

vehicle_id: string;

user_id?: string;

pickup_location: string;

drop_location: string;

start_date: string;

end_date: string;

purpose: string;

status?: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';

created_at?: string;

}