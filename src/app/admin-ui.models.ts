import { Vehicle } from './models/vehicle';

export interface DashboardBooking {
  id: string;
  rawId?: string;
  vehicleId?: string;
  userId?: string;
  vehicle: string;
  vehicleType: string;
  userName: string;
  userEmail: string;
  startDate: string;
  endDate: string;
  status: 'Pending' | 'Approved' | 'InProgress' | 'Completed' | 'Cancelled';
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  pickup: string;
  assignedTo: string;
  cost: number;
  purpose: 'Corporate' | 'Personal' | 'Event' | 'Transfer' | 'Other';
}

function mapBookingStatus(status: string | null | undefined, index: number): DashboardBooking['status'] {
  const normalized = String(status || '').toLowerCase();
  switch (normalized) {
    case 'pending':
      return 'Pending';
    case 'approved':
      return 'Approved';
    case 'inprogress':
    case 'in_progress':
    case 'active':
      return 'InProgress';
    case 'completed':
      return 'Completed';
    case 'cancelled':
    case 'canceled':
      return 'Cancelled';
    default:
      return (['Pending', 'Approved', 'InProgress', 'Completed', 'Cancelled'][index % 5]) as DashboardBooking['status'];
  }
}

export interface DashboardActivity {
  actor: string;
  action: string;
  icon: string;
  time: string;
  color: string;
}

export interface ActionItem {
  type: 'danger' | 'warning';
  icon: string;
  title: string;
  detail: string;
  route: string;
}

export function normalizeVehicle(vehicle: Vehicle, index: number) {
  const raw = vehicle as Record<string, any>;
  const make = vehicle.make || vehicle.brand || vehicle.Brand || `Vehicle ${index + 1}`;
  const model = vehicle.model || `Series ${index + 1}`;
  const statusSource = String(raw['vehicle_status'] || raw['status'] || 'available').toLowerCase();
  const mappedStatus =
    statusSource === 'deleted'
      ? 'Inactive'
      : statusSource === 'inactive' || statusSource === 'maintenance' || statusSource === 'dirty'
        ? 'Maintenance'
        : statusSource === 'booked'
          ? 'Booked'
        : 'Available';

  return {
    ...vehicle,
    id: vehicle.id || `veh-${index + 1}`,
    make,
    model,
    year: Number(raw['year'] || 2021 + (index % 4)),
    chassisNumber: String(
      raw['chassisNumber'] || raw['chassis_no'] || raw['registration_no'] || `CHS-${1100 + index}`
    ),
    registrationNo: String(raw['registrationNo'] || raw['registration_no'] || `DL${index + 11}AB${4100 + index}`),
    type: raw['type'] || ['SUV', 'Sedan', 'Truck', 'Van'][index % 4],
    capacity: Number(raw['capacity'] || 4 + (index % 3) * 2),
    fuel: raw['fuel'] || ['Petrol', 'Diesel', 'Electric', 'Hybrid'][index % 4],
    mileage: Number(raw['mileage'] || 8000 + index * 1200),
    color: raw['color'] || ['#1A56DB', '#0E9F6E', '#7E3AF2', '#E02424'][index % 4],
    fillRate: Math.min(96, 42 + index * 7),
    imageUrl:
      raw['imageUrl'] ||
      `https://images.unsplash.com/photo-${['1494976388531-d1058494cdd8', '1503376780353-7e6692767b70', '1541899481282-d53bffe3c35d', '1492144534655-ae79c964c9d7'][index % 4]}?auto=format&fit=crop&w=800&q=80`,
    dailyRate: Number(raw['daily_rate'] || raw['dailyRate'] || 2800 + index * 450),
    stock: Number(raw['stock'] || 1 + (index % 5)),
    location: raw['location'] || ['Delhi', 'Gurugram', 'Noida', 'Bengaluru'][index % 4],
    status: mappedStatus as 'Available' | 'Booked' | 'Maintenance' | 'Inactive',
    rawStatus: statusSource,
    vehicleStatus: statusSource,
    nextAvailableDate: raw['next_available_date'] || null,
  };
}

export function buildBookings(
  vehicles: ReturnType<typeof normalizeVehicle>[],
  bookingRows?: Array<Record<string, any>>
) {
  if (!bookingRows?.length) {
    return vehicles.slice(0, 10).map((vehicle, index) => ({
      id: `VMS-${String(index + 1).padStart(4, '0')}`,
      rawId: `demo-${index + 1}`,
      vehicleId: vehicle.id,
      userId: `demo-user-${index + 1}`,
      vehicle: `${vehicle.make} ${vehicle.model}`,
      vehicleType: vehicle.type,
      userName: ['Aarav Mehta', 'Priya Singh', 'Rohan Nair', 'Ishita Patel', 'Kabir Shah'][index % 5],
      userEmail: `user${index + 1}@vehicleadmin.io`,
      startDate: new Date(2026, 2, 23 + (index % 4), 9 + index, 0).toISOString(),
      endDate: new Date(2026, 2, 24 + (index % 5), 18, 0).toISOString(),
      status: (['Pending', 'Approved', 'InProgress', 'Completed', 'Cancelled'][index % 5]) as DashboardBooking['status'],
      priority: (['Low', 'Normal', 'High', 'Urgent'][index % 4]) as DashboardBooking['priority'],
      pickup: ['Connaught Place, Delhi', 'Cyber Hub, Gurugram', 'Sector 18, Noida', 'Indiranagar, Bengaluru'][index % 4],
      assignedTo: index % 3 === 0 ? 'Unassigned' : ['Ananya Rao', 'Dev Malhotra', 'Sana Khan'][index % 3],
      cost: vehicle.dailyRate * (1 + (index % 3)),
      purpose: (['Corporate', 'Personal', 'Event', 'Transfer', 'Other'][index % 5]) as DashboardBooking['purpose'],
    }));
  }

  const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  return bookingRows.map((booking, index) => {
    const vehicle = vehicleById.get(String(booking['vehicle_id'])) || vehicles[index % Math.max(vehicles.length, 1)];
    const userSeed = String(booking['user_id'] || `user-${index + 1}`);
    const shortId = String(booking['id'] || index + 1).replace(/-/g, '').slice(0, 4).toUpperCase();
    const firstNames = ['Aarav', 'Priya', 'Rohan', 'Ishita', 'Kabir', 'Neha'];
    const lastNames = ['Mehta', 'Singh', 'Nair', 'Patel', 'Shah', 'Rao'];
    const purposeSource = String(booking['purpose'] || ['Corporate', 'Personal', 'Event', 'Transfer', 'Other'][index % 5]);
    const purpose = (['Corporate', 'Personal', 'Event', 'Transfer', 'Other'].includes(purposeSource)
      ? purposeSource
      : ['Corporate', 'Personal', 'Event', 'Transfer', 'Other'][index % 5]) as DashboardBooking['purpose'];

    return {
      id: `VMS-${shortId.padStart(4, '0')}`,
      rawId: String(booking['id'] || ''),
      vehicleId: String(booking['vehicle_id'] || vehicle?.id || ''),
      userId: String(booking['user_id'] || ''),
      vehicle: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unassigned Vehicle',
      vehicleType: vehicle?.type || ['SUV', 'Sedan', 'Truck', 'Van'][index % 4],
      userName: `${firstNames[index % firstNames.length]} ${lastNames[index % lastNames.length]}`,
      userEmail: `${userSeed.slice(0, 8).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || `user${index + 1}`}@vehicleadmin.io`,
      startDate: new Date(`${booking['start_date'] || new Date().toISOString().slice(0, 10)}T09:00:00`).toISOString(),
      endDate: new Date(`${booking['end_date'] || new Date().toISOString().slice(0, 10)}T18:00:00`).toISOString(),
      status: mapBookingStatus(booking['status'], index),
      priority: (['Low', 'Normal', 'High', 'Urgent'][index % 4]) as DashboardBooking['priority'],
      pickup: booking['pickup_location'] || ['Connaught Place, Delhi', 'Cyber Hub, Gurugram', 'Sector 18, Noida', 'Indiranagar, Bengaluru'][index % 4],
      assignedTo: index % 3 === 0 ? 'Unassigned' : ['Ananya Rao', 'Dev Malhotra', 'Sana Khan'][index % 3],
      cost: Number(vehicle?.dailyRate || 2800) * Math.max(1, index % 3 + 1),
      purpose,
    };
  });
}

export function buildActivityFeed(): DashboardActivity[] {
  return [
    { actor: 'Ananya Rao', action: 'assigned a pending booking to the call center queue', icon: 'pi pi-send', time: '2 min ago', color: '#1A56DB' },
    { actor: 'Priya Singh', action: 'completed a chauffeur booking successfully', icon: 'pi pi-calendar', time: '8 min ago', color: '#0E9F6E' },
    { actor: 'Fleet Ops', action: 'moved Tata Harrier to maintenance review', icon: 'pi pi-car', time: '14 min ago', color: '#C27803' },
    { actor: 'Rahul Verma', action: 'registered a new corporate user profile', icon: 'pi pi-user', time: '21 min ago', color: '#7E3AF2' },
    { actor: 'System', action: 'flagged registration renewal due in 3 days', icon: 'pi pi-exclamation-circle', time: '34 min ago', color: '#E02424' },
  ];
}

export function buildActionItems(): ActionItem[] {
  return [
    { type: 'danger', icon: 'pi pi-clock', title: 'Overdue booking', detail: 'VMS-0007 has not been closed after the scheduled return time.', route: '/admin/bookings' },
    { type: 'warning', icon: 'pi pi-wrench', title: 'Vehicle due for service', detail: 'Mahindra Scorpio crossed its service threshold today.', route: '/admin/vehicles' },
    { type: 'danger', icon: 'pi pi-send', title: 'Unassigned pending booking', detail: 'Two urgent requests still need an assignee.', route: '/admin/bookings' },
    { type: 'warning', icon: 'pi pi-id-card', title: 'Expiring registration', detail: 'DL11AB4103 needs renewal approval this week.', route: '/admin/vehicles' },
  ];
}

export function tagSeverityForStatus(status: string): 'success' | 'warn' | 'danger' | 'info' | 'secondary' | 'contrast' {
  const normalized = status.toLowerCase();
  switch (normalized) {
    case 'available':
    case 'approved':
    case 'completed':
      return 'success';
    case 'booked':
    case 'pending':
      return 'warn';
    case 'inservice':
    case 'in_service':
    case 'in progress':
    case 'inprogress':
      return 'info';
    case 'maintenance':
    case 'rejected':
      return 'danger';
    case 'cancelled':
    case 'canceled':
      return 'secondary';
    case 'inactive':
    default:
      return 'secondary';
  }
}

export function tagSeverityForPriority(priority: string): 'secondary' | 'warn' | 'danger' {
  switch (priority.toLowerCase()) {
    case 'urgent':
      return 'danger';
    case 'high':
      return 'warn';
    default:
      return 'secondary';
  }
}
