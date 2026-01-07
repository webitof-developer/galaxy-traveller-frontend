'use client';
import { useEffect, useState } from 'react';
import { CalendarIcon, Users, Plus, Minus } from 'lucide-react';
import { format, addDays } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../../lib/utils';
import PaymentDialog from './PaymentDialog';
import BookingProcessingOverlay from '../common/ProcessDialog';
import client from '@/api/client';
import AuthDialog from '../Auth/authDialog';
import { getPaymentGateways, createPayment } from '../../lib/razorpay';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';
import EnquiryDialog from './EnquiryDialog';

export default function BookingCard({
  tourName,
  basePrice,
  tourDuration = 3,
  tourType = 'fixed_date',
  tourId,
  getDateRange,
  creatorId,
  tourLocation,
  paymentConfig = {
    full: { enabled: true },
    partial: { enabled: false, price: 0 },
  },
}) {
  // console.log("tourType", tourType, tourId);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const [gateways, setGateways] = useState([]);

  const [dateRange, setDateRange] = useState(getDateRange);
  const [guests, setGuests] = useState({ adults: 2, children: 0 });
  const [selectedTab, setSelectedTab] = useState(
    tourType == 'both' ? 'fixed_date' : tourType,
  );
  const [showGuestDetails, setShowGuestDetails] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const showBookingBtn =
    dateRange?.startDate instanceof Date &&
    dateRange.startDate.getTime() > Date.now();

  // Contact form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const isValidDate = (date) => date instanceof Date && !isNaN(date);

  useEffect(() => {
    if (tourType === 'fixed_date' && getDateRange) {
      const { startDate, endDate } = getDateRange;
      const validStartDate = isValidDate(startDate) ? startDate : null;
      const validEndDate = isValidDate(endDate) ? endDate : null;
      setDateRange({ startDate: validStartDate, endDate: validEndDate });
    }
  }, [tourType, getDateRange]);

  const handleSelect = (day) => {
    if (!day) return;
    const raw = tourDuration;
    const duration =
      typeof raw === 'number'
        ? raw
        : parseInt(String(raw).replace(/\D/g, ''), 10);

    const end = addDays(day, duration - 1);

    setDateRange({ startDate: day, endDate: end });
  };

  const increment = (type) => setGuests((g) => ({ ...g, [type]: g[type] + 1 }));
  const decrement = (type) =>
    setGuests((g) => ({ ...g, [type]: Math.max(0, g[type] - 1) }));

  const [paymentMode, setPaymentMode] = useState('full');
  const [bookingProcessing, setBookingProcessing] = useState(false);

  const totalGuests = guests.adults + guests.children;
  const partialEnabled = paymentConfig?.partial?.enabled;
  const partialPrice = Number(paymentConfig?.partial?.price || 0);

  const fullAmount = basePrice * totalGuests;

  const [showAuth, setShowAuth] = useState(false);
  const [pendingBookingPayload, setPendingBookingPayload] = useState(null);
  const router = useRouter();
  const handleTabChange = (type) => {
    setSelectedTab(type);
    if (type === 'fixed_date') {
      setDateRange(getDateRange);
    }
  };

  const effectiveType = tourType === 'both' ? selectedTab : tourType;

  const handleSendEnquiry = async (payload) => {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_API}/api/enquiries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          tour: tourId,
          tourCreatedBy: creatorId,
        }),
      },
    );

    const result = await res.json();

    if (!result.success) {
      console.error('Failed to send enquiry');
      return;
    }

    setShowDialog(false);
    toast.success('Enquiry sent successfully');
  };

  const handleConfirmPayment = async ({ selectedPayment, finalPayable }) => {
    const token = localStorage.getItem('token');

    // 🔐 1. Login check
    if (!token) {
      setShowBookingModal(false);
      setShowAuth(true);
      return;
    }

    try {
      setBookingProcessing(true);

      const partialAmount =
        selectedPayment === 'partial'
          ? paymentConfig.partial.price * totalGuests
          : null;

      console.log(
        'Booking Payment Details:',
        selectedPayment,
        finalPayable,
        partialAmount,
      );

      // 2️⃣ CREATE BOOKING (PENDING)
      const bookingRes = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_API}/api/booking`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tour: tourId,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            guests,
            totalPersons: totalGuests,
            contactInfo: { name, email, phone },
            payment: {
              paymentMode: selectedPayment,
              partialAmount,
              totalAmount: fullAmount,
              amountPaid: 0,
              remainingAmount: fullAmount,
            },

            bookingStatus: 'pending',
          }),
        },
      );

      const bookingData = await bookingRes.json();
      console.log('Booking Response:', bookingData);

      if (!bookingData?.success) {
        throw new Error(bookingData?.message || 'Booking creation failed');
      }

      const bookingId = bookingData.data.id;

      // 3️⃣ CREATE RAZORPAY ORDER
      const order = await createPayment({
        gateway: 'razorpay',
        bookingId,
        paymentMode: selectedPayment,
      });

      console.log('Razorpay Order:', order);

      if (!order || !order.id) {
        throw new Error('Razorpay order creation failed');
      }

      // 4️⃣ OPEN RAZORPAY
      const options = {
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: tourName,
        description: 'Tour Booking',
        prefill: {
          name,
          email,
          contact: phone,
        },
        modal: {
          ondismiss: () => {
            toast.error(
              'Payment was cancelled. Your booking is still pending.',
            );
          },
        },
        handler: async function (response) {
          console.log('Final Payable Amount:', finalPayable);

          await verifyAndConfirmBooking({
            bookingId,
            response,
            token,
            finalPayable,
            paymentMode: selectedPayment,
          });
        },
      };

      console.log('Razorpay Options:', options);

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setBookingProcessing(false);
    }
  };

  const verifyAndConfirmBooking = async ({
    bookingId,
    response,
    token,
    finalPayable,
    paymentMode,
  }) => {
    // 5️⃣ VERIFY PAYMENT
    const verifyRes = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_API}/api/payment/verify`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId,
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
          paymentMode,
        }),
      },
    );

    const verifyData = await verifyRes.json();

    if (!verifyData.success) {
      toast.error('Payment verification failed');
      return;
    }

    // ✅ DONE
    setShowBookingModal(false);
    toast.success('Booking confirmed successfully!');
  };

  return (
    <>
      <Card className='w-full max-w-2xl shadow-xs border-border'>
        <CardHeader className='flex flex-col gap-1'>
          <h2 className='text-lg sm:text-xl md:text-2xl font-semibold text-foreground'>
            Book Your Journey
          </h2>
          <CardDescription className='text-sm sm:text-base text-muted-foreground'>
            Select your travel dates and number of guests
          </CardDescription>
        </CardHeader>

        <CardContent className='flex flex-col gap-4'>
          {/* Tab Selector */}
          {tourType === 'both' && (
            <Tabs
              value={selectedTab}
              onValueChange={handleTabChange}
              className='w-full'>
              <TabsList className='grid w-full grid-cols-2 text-sm sm:text-base'>
                <TabsTrigger value='fixed_date'>Fixed Date</TabsTrigger>
                <TabsTrigger value='flexible_date'>Flexible Date</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {/* Date Range Picker */}
          <div className='flex text-muted-foreground hover:text-primary flex-col gap-2'>
            <Label
              htmlFor='dates'
              className='text-sm sm:text-base font-medium text-muted-foreground'>
              Travel Dates
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id='dates'
                  disabled={selectedTab === 'fixed_date'}
                  variant='outline'
                  className={cn(
                    'w-full justify-start text-left text-muted-foreground hover:text-primary font-normal h-12 border-input hover:bg-gray-100 transition-colors text-sm sm:text-base',
                    !dateRange && 'text-muted-foreground',
                  )}>
                  <CalendarIcon className='mr-2 h-4 w-4 text-primary  ' />
                  {dateRange?.startDate ? (
                    dateRange.endDate ? (
                      <>
                        {format(dateRange.startDate, 'MMM d, yyyy')} -{' '}
                        {format(dateRange.endDate, 'MMM d, yyyy')}
                      </>
                    ) : (
                      format(dateRange.startDate, 'MMM d, yyyy')
                    )
                  ) : (
                    <span className='text-muted-foreground hover:text-primary'>
                      Pick your dates
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className='w-auto p-0' align='start'>
                <Calendar
                  initialFocus
                  mode='single'
                  defaultMonth={dateRange?.startDate}
                  selected={dateRange?.startDate}
                  onSelect={handleSelect}
                  disabled={(date) => date < new Date()}
                  className='pointer-events-auto'
                  classNames={{
                    day_selected:
                      'bg-primary  text-white hover:bg-gray-100  focus:bg-primary ',
                    day_today: 'border border-primary ',
                    day: 'hover:bg-orange-100',
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          {/* Guests Selector */}
          <div className='flex flex-col gap-2'>
            <Label
              htmlFor='guests'
              className='text-sm sm:text-base font-medium text-muted-foreground'>
              Guests
            </Label>
            <Button
              id='guests'
              variant='outline'
              onClick={() => setShowGuestDetails(!showGuestDetails)}
              className='w-full  justify-start text-left font-normal text-muted-foreground hover:text-primary h-12 border-input hover:bg-gray-100 transition-colors text-sm sm:text-base'>
              <Users className='mr-2 h-4 w-4 text-primary ' />
              {totalGuests} {totalGuests === 1 ? 'Guest' : 'Guests'}
            </Button>

            {showGuestDetails && (
              <div className='mt-3 p-4 border border-border rounded-lg bg-card flex flex-col gap-4'>
                {/* Adults */}
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='font-medium text-foreground text-sm sm:text-base'>
                      Adults
                    </p>
                    <p className='text-xs sm:text-sm text-muted-foreground'>
                      Ages 13+
                    </p>
                  </div>
                  <div className='flex items-center gap-3'>
                    <Button
                      size='icon'
                      variant='outline'
                      onClick={() => decrement('adults')}
                      disabled={guests.adults <= 1}
                      className='h-8 w-8 sm:h-9 sm:w-9 rounded-full border-input hover:bg-gray-100'>
                      <Minus className='h-4 w-4 text-primary ' />
                    </Button>
                    <span className='w-6 sm:w-8 text-center font-medium text-foreground text-sm sm:text-base'>
                      {guests.adults}
                    </span>
                    <Button
                      size='icon'
                      variant='outline'
                      onClick={() => increment('adults')}
                      disabled={guests.adults >= 10}
                      className='h-8 w-8 sm:h-9 sm:w-9 rounded-full border-input hover:bg-gray-100'>
                      <Plus className='h-4 w-4 text-primary ' />
                    </Button>
                  </div>
                </div>

                {/* Children */}
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='font-medium text-foreground text-sm sm:text-base'>
                      Children
                    </p>
                    <p className='text-xs sm:text-sm text-muted-foreground'>
                      Ages 0–12
                    </p>
                  </div>
                  <div className='flex items-center gap-3'>
                    <Button
                      size='icon'
                      variant='outline'
                      onClick={() => decrement('children')}
                      disabled={guests.children <= 0}
                      className='h-8 w-8 sm:h-9 sm:w-9 rounded-full border-input hover:bg-gray-100'>
                      <Minus className='h-4 w-4 text-primary ' />
                    </Button>
                    <span className='w-6 sm:w-8 text-center font-medium text-foreground text-sm sm:text-base'>
                      {guests.children}
                    </span>
                    <Button
                      size='icon'
                      variant='outline'
                      onClick={() => increment('children')}
                      disabled={guests.children >= 10}
                      className='h-8 w-8 sm:h-9 sm:w-9 rounded-full border-input hover:bg-gray-100'>
                      <Plus className='h-4 w-4 text-primary ' />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          {/* Action Buttons */}{' '}
          {showBookingBtn &&
            (effectiveType !== 'fixed_date' ? (
              <Button
                onClick={() => {
                  if (!dateRange?.startDate || !dateRange?.endDate) {
                    toast.error('Please select travel dates');
                    return;
                  }
                  setShowDialog(true);
                }}
                className='w-full h-11 sm:h-12 bg-primary text-white font-medium'>
                Continue
              </Button>
            ) : (
              <Button
                onClick={() => setShowBookingModal(true)}
                className='w-full h-11 sm:h-12 bg-primary text-white font-medium'>
                Book Now
              </Button>
            ))}
        </CardContent>
      </Card>

      {/* Dialog */}
      <EnquiryDialog
        open={showDialog}
        setOpen={setShowDialog}
        basePrice={basePrice}
        guests={guests} // ✅ object { adults, children }
        dateRange={dateRange}
        onSubmit={handleSendEnquiry}
      />

      {/* Payment Modal */}
      <PaymentDialog
        showBookingModal={showBookingModal}
        setShowBookingModal={setShowBookingModal}
        tourName={tourName}
        tourLocation={tourLocation}
        dateRange={dateRange}
        guests={guests}
        amount={fullAmount} // always pass full price
        paymentMode='full' // default
        paymentConfig={paymentConfig}
        onConfirmPayment={handleConfirmPayment}
      />
      <BookingProcessingOverlay
        open={bookingProcessing}
        text='Processing your booking...'
      />
      <AuthDialog
        open={showAuth}
        onOpenChange={setShowAuth}
        onAuthSuccess={() => {
          setShowAuth(false);

          // 🔁 Resume booking automatically
          if (pendingBookingPayload) {
            handleConfirmPayment(pendingBookingPayload);
            setPendingBookingPayload(null);
          }
        }}
      />
    </>
  );
}
