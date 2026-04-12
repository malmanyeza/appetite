import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { useTheme } from '../theme';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { ArrowLeft, User, Phone, MapPin, Briefcase, FileText, CheckCircle2, ChevronRight, Camera, CreditCard } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';

// Custom lightweight polyfill to decode base64 into a pure ArrayBuffer exactly compatible with Supabase Storage
const decodeBase64 = (base64String: string) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) {
        lookup[chars.charCodeAt(i)] = i;
    }

    let bufferLength = base64String.length * 0.75;
    if (base64String[base64String.length - 1] === '=') bufferLength--;
    if (base64String[base64String.length - 2] === '=') bufferLength--;

    const arraybuffer = new ArrayBuffer(bufferLength);
    const bytes = new Uint8Array(arraybuffer);

    let p = 0;
    for (let i = 0; i < base64String.length; i += 4) {
        let encoded1 = lookup[base64String.charCodeAt(i)];
        let encoded2 = lookup[base64String.charCodeAt(i + 1)];
        let encoded3 = lookup[base64String.charCodeAt(i + 2)];
        let encoded4 = lookup[base64String.charCodeAt(i + 3)];

        bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
        bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return arraybuffer;
};

export const DriverOnboarding = ({ navigation }: any) => {
    const { theme } = useTheme();
    const insets = useSafeAreaInsets();
    const { user, profile } = useAuthStore();
    const queryClient = useQueryClient();
    const [step, setStep] = useState(0); // 0: Gate, 1: Basic, 2: Vehicle, 3: Docs, 4: Payout
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [displayProgress, setDisplayProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Smoothing effect for progress bar to show 1% increments
    React.useEffect(() => {
        if (loading && displayProgress < uploadProgress) {
            const timer = setTimeout(() => {
                setDisplayProgress(prev => Math.min(prev + 1, uploadProgress));
            }, 30); // 30ms for smooth 1% increments
            return () => clearTimeout(timer);
        } else if (!loading && uploadProgress === 0) {
            setDisplayProgress(0);
        }
    }, [loading, displayProgress, uploadProgress]);

    // Form State
    const [phone, setPhone] = useState(profile?.phone || '');
    const [city, setCity] = useState('');
    const [vehicleType, setVehicleType] = useState('Bike'); // Bike, Car, Motorbike
    const [plateNumber, setPlateNumber] = useState('');
    const [emergencyContact, setEmergencyContact] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [ecocashNumber, setEcocashNumber] = useState('');
    const [accountName, setAccountName] = useState('');
    const [idPhoto, setIdPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [selfie, setSelfie] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [registrationBook, setRegistrationBook] = useState<ImagePicker.ImagePickerAsset | null>(null);
    const [driversLicense, setDriversLicense] = useState<ImagePicker.ImagePickerAsset | null>(null);

    const pickImage = async (type: 'id' | 'selfie' | 'registration_book' | 'drivers_license') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.5,
            base64: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            if (type === 'id') setIdPhoto(result.assets[0]);
            else if (type === 'selfie') setSelfie(result.assets[0]);
            else if (type === 'drivers_license') setDriversLicense(result.assets[0]);
            else setRegistrationBook(result.assets[0]);
        }
    };

    const handleSubmit = async () => {
        if (!ecocashNumber || !accountName) {
            Alert.alert('Missing Info', 'Please provide your payout details.');
            return;
        }

        setLoading(true);
        setUploadProgress(10);
        setError(null);
        try {
            if (phone && phone !== profile?.phone) {
                await supabase.from('profiles').update({ phone }).eq('id', user?.id);
            }
            
            setUploadProgress(20);

            let idPhotoUrl = null;
            let selfieUrl = null;
            let regBookUrl = null;
            let driversLicenseUrl = null;

            if (idPhoto && idPhoto.base64) {
                const buffer = decodeBase64(idPhoto.base64);
                const path = `applications/${user?.id}/id_${Date.now()}.jpg`;
                const { error: uploadError } = await supabase.storage.from('driver-documents').upload(path, buffer, {
                    contentType: 'image/jpeg',
                    upsert: true
                });
                if (uploadError) {
                    throw new Error('Failed to upload ID photo: ' + uploadError.message);
                }
                const { data } = supabase.storage.from('driver-documents').getPublicUrl(path);
                idPhotoUrl = data.publicUrl;
            }
            setUploadProgress(40);

            if (selfie && selfie.base64) {
                const buffer = decodeBase64(selfie.base64);
                const path = `applications/${user?.id}/selfie_${Date.now()}.jpg`;
                const { error: uploadError } = await supabase.storage.from('driver-documents').upload(path, buffer, {
                    contentType: 'image/jpeg',
                    upsert: true
                });
                if (uploadError) {
                    throw new Error('Failed to upload profile selfie: ' + uploadError.message);
                }
                const { data } = supabase.storage.from('driver-documents').getPublicUrl(path);
                selfieUrl = data.publicUrl;
            }
            setUploadProgress(60);

            if (registrationBook && registrationBook.base64) {
                const buffer = decodeBase64(registrationBook.base64);
                const path = `applications/${user?.id}/reg_book_${Date.now()}.jpg`;
                const { error: uploadError } = await supabase.storage.from('driver-documents').upload(path, buffer, {
                    contentType: 'image/jpeg',
                    upsert: true
                });
                if (uploadError) {
                    throw new Error('Failed to upload registration book: ' + uploadError.message);
                }
                const { data } = supabase.storage.from('driver-documents').getPublicUrl(path);
                regBookUrl = data.publicUrl;
            }
            setUploadProgress(80);

            if (driversLicense && driversLicense.base64) {
                const buffer = decodeBase64(driversLicense.base64);
                const path = `applications/${user?.id}/drivers_license_${Date.now()}.jpg`;
                const { error: uploadError } = await supabase.storage.from('driver-documents').upload(path, buffer, {
                    contentType: 'image/jpeg',
                    upsert: true
                });
                if (uploadError) {
                    throw new Error('Failed to upload driver\'s license: ' + uploadError.message);
                }
                const { data } = supabase.storage.from('driver-documents').getPublicUrl(path);
                driversLicenseUrl = data.publicUrl;
            }
            setUploadProgress(90);

            const { error } = await supabase.from('driver_profiles').upsert({
                user_id: user?.id,
                city,
                vehicle_type: vehicleType.toLowerCase(),
                plate_number: plateNumber,
                emergency_contact: emergencyContact,
                ecocash_number: ecocashNumber,
                account_name: accountName,
                id_photo_url: idPhotoUrl,
                selfie_url: selfieUrl,
                registration_book_url: regBookUrl,
                drivers_license_url: driversLicenseUrl,
                status: 'pending',
                is_online: false
            });

            if (error) throw error;
            setUploadProgress(100);

            queryClient.setQueryData(['driver-profile', user?.id], { status: 'pending' });
            queryClient.invalidateQueries({ queryKey: ['driver-profile', user?.id] });

            setStep(5); // Success step
        } catch (error: any) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const renderHeader = (title: string, subtitle: string) => (
        <View style={styles.header}>
            <TouchableOpacity onPress={() => step === 0 ? navigation.goBack() : setStep(step - 1)} style={styles.backBtn}>
                <ArrowLeft color={theme.text} size={24} />
            </TouchableOpacity>
            <View>
                <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
            </View>
        </View>
    );

    const renderGate = () => (
        <ScrollView 
            contentContainerStyle={[styles.fullCenter, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
        >
            <View style={[styles.iconCircle, { backgroundColor: `${theme.accent}15` }]}>
                <Briefcase size={48} color={theme.accent} />
            </View>
            <Text style={[styles.gateTitle, { color: theme.text }]}>Become a Driver</Text>
            <Text style={[styles.gateSub, { color: theme.textMuted }]}>
                To deliver with Appetite, we need a few details to get you set up and ready to earn on your own schedule.
            </Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.accent }]} onPress={() => setStep(1)}>
                <Text style={styles.buttonText}>Start Driver Setup</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.goBack()}>
                <Text style={[styles.secondaryText, { color: theme.textMuted }]}>Not now</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const renderBasicInfo = () => (
        <ScrollView 
            style={styles.formContent} 
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            showsVerticalScrollIndicator={false}
        >
            {renderHeader('Basic Details', 'Step 1 of 4: Personal Information')}

            <View style={[styles.inputGroup, { backgroundColor: theme.surface }]}>
                <User size={20} color={theme.textMuted} />
                <TextInput
                    style={[styles.input, { color: theme.textMuted }]}
                    value={profile?.full_name || ''}
                    editable={false}
                    placeholder="Full Name"
                    placeholderTextColor={theme.textMuted}
                />
            </View>

            <View style={[styles.inputGroup, { backgroundColor: theme.surface }]}>
                <Phone size={20} color={theme.textMuted} />
                <TextInput
                    style={[styles.input, { color: theme.text }]}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Phone Number"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="phone-pad"
                />
            </View>

            <View style={[styles.inputGroup, { backgroundColor: theme.surface }]}>
                <MapPin size={20} color={theme.textMuted} />
                <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="City (e.g. Harare)"
                    placeholderTextColor={theme.textMuted}
                    value={city}
                    onChangeText={setCity}
                />
            </View>

            <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.accent, marginTop: 40 }]}
                onPress={() => {
                    if (!phone || !city) {
                        Alert.alert('Missing Info', 'Please enter your phone and city.');
                        return;
                    }
                    setStep(2);
                }}
            >
                <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const renderVehicle = () => (
        <ScrollView 
            style={styles.formContent} 
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            showsVerticalScrollIndicator={false}
        >
            {renderHeader('Vehicle Details', 'Step 2 of 4: Delivery Options')}

            <Text style={[styles.label, { color: theme.text }]}>Vehicle Type</Text>
            <View style={styles.row}>
                {['Bike', 'Car', 'Motorbike'].map(type => (
                    <TouchableOpacity
                        key={type}
                        style={[
                            styles.typeCard,
                            { backgroundColor: theme.surface },
                            vehicleType === type && { borderColor: theme.accent, borderWidth: 2 }
                        ]}
                        onPress={() => setVehicleType(type)}
                    >
                        <Text style={[styles.typeText, { color: vehicleType === type ? theme.accent : theme.text }]}>{type}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={[styles.label, { color: theme.text, marginTop: 24 }]}>License Plate (if applicable)</Text>
            <View style={[styles.inputGroup, { backgroundColor: theme.surface }]}>
                <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="e.g. AB 1234"
                    placeholderTextColor={theme.textMuted}
                    value={plateNumber}
                    onChangeText={setPlateNumber}
                />
            </View>

            <Text style={[styles.label, { color: theme.text, marginTop: 24 }]}>Emergency Contact (Optional)</Text>
            <View style={[styles.inputGroup, { backgroundColor: theme.surface }]}>
                <Phone size={20} color={theme.textMuted} />
                <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Phone Number"
                    placeholderTextColor={theme.textMuted}
                    value={emergencyContact}
                    onChangeText={setEmergencyContact}
                    keyboardType="phone-pad"
                />
            </View>

            <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.accent, marginTop: 40 }]}
                onPress={() => setStep(3)}
            >
                <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const renderDocuments = () => (
        <ScrollView 
            style={styles.formContent} 
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            showsVerticalScrollIndicator={false}
        >
            {renderHeader('Documents', 'Step 3 of 4: Verification (Optional for MVP)')}

            <TouchableOpacity style={[styles.uploadBox, { backgroundColor: theme.surface }]} onPress={() => pickImage('id')}>
                {idPhoto ? (
                    <ExpoImage 
                        source={{ uri: idPhoto.uri }} 
                        style={{ width: '100%', height: '100%', borderRadius: 12 }} 
                        contentFit="cover" 
                        cachePolicy="disk"
                    />
                ) : (
                    <>
                        <Camera size={32} color={theme.textMuted} />
                        <Text style={[styles.uploadText, { color: theme.text }]}>Upload ID Photo</Text>
                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>(You can add this later)</Text>
                    </>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.uploadBox, { backgroundColor: theme.surface }]} onPress={() => pickImage('selfie')}>
                {selfie ? (
                    <ExpoImage 
                        source={{ uri: selfie.uri }} 
                        style={{ width: '100%', height: '100%', borderRadius: 12 }} 
                        contentFit="cover" 
                        cachePolicy="disk"
                    />
                ) : (
                    <>
                        <User size={32} color={theme.textMuted} />
                        <Text style={[styles.uploadText, { color: theme.text }]}>Upload Profile Selfie</Text>
                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>(Required for verification)</Text>
                    </>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.uploadBox, { backgroundColor: theme.surface }]} onPress={() => pickImage('drivers_license')}>
                {driversLicense ? (
                    <ExpoImage 
                        source={{ uri: driversLicense.uri }} 
                        style={{ width: '100%', height: '100%', borderRadius: 12 }} 
                        contentFit="cover" 
                        cachePolicy="disk"
                    />
                ) : (
                    <>
                        <CreditCard size={32} color={theme.textMuted} />
                        <Text style={[styles.uploadText, { color: theme.text }]}>Driver's License</Text>
                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>(Required to drive on platform)</Text>
                    </>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={[styles.uploadBox, { backgroundColor: theme.surface }]} onPress={() => pickImage('registration_book')}>
                {registrationBook ? (
                    <ExpoImage 
                        source={{ uri: registrationBook.uri }} 
                        style={{ width: '100%', height: '100%', borderRadius: 12 }} 
                        contentFit="cover" 
                        cachePolicy="disk"
                    />
                ) : (
                    <>
                        <FileText size={32} color={theme.textMuted} />
                        <Text style={[styles.uploadText, { color: theme.text }]}>Reg. Book / Logbook</Text>
                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>(Required for Car/Motorbike)</Text>
                    </>
                )}
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setTermsAccepted(!termsAccepted)}
            >
                <View style={[
                    styles.checkbox,
                    { borderColor: theme.border },
                    termsAccepted && { backgroundColor: theme.accent, borderColor: theme.accent }
                ]}>
                    {termsAccepted && <CheckCircle2 size={16} color="white" />}
                </View>
                <Text style={[styles.termsText, { color: theme.text }]}>
                    I agree to the Driver Terms of Service and Privacy Policy.
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: termsAccepted ? theme.accent : theme.border, marginTop: 40 }]}
                onPress={() => {
                    if (!termsAccepted) {
                        Alert.alert('Terms Required', 'Please accept the terms of service.');
                        return;
                    }
                    setStep(4);
                }}
            >
                <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const renderPayout = () => (
        <ScrollView 
            style={styles.formContent} 
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            showsVerticalScrollIndicator={false}
        >
            {renderHeader('Payout Details', 'Step 4 of 4: How you get paid')}

            <View style={[styles.infoBanner, { backgroundColor: `${theme.accent}10`, marginBottom: 24 }]}>
                <Text style={[styles.infoText, { color: theme.text }]}>
                    Please provide your EcoCash details. We will use this information to send your earnings.
                </Text>
            </View>

            <Text style={[styles.label, { color: theme.text }]}>EcoCash Registered Number</Text>
            <View style={[styles.inputGroup, { backgroundColor: theme.surface }]}>
                <Phone size={20} color={theme.textMuted} />
                <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="e.g. 0771234567"
                    placeholderTextColor={theme.textMuted}
                    value={ecocashNumber}
                    onChangeText={setEcocashNumber}
                    keyboardType="phone-pad"
                />
            </View>

            <Text style={[styles.label, { color: theme.text, marginTop: 24 }]}>Registered Account Name</Text>
            <View style={[styles.inputGroup, { backgroundColor: theme.surface }]}>
                <User size={20} color={theme.textMuted} />
                <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="Name as it appears on EcoCash"
                    placeholderTextColor={theme.textMuted}
                    value={accountName}
                    onChangeText={setAccountName}
                />
            </View>

            <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: theme.accent, marginTop: 40, overflow: 'hidden' }]}
                onPress={handleSubmit}
                disabled={loading}
            >
                {loading && (
                    <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${displayProgress}%`, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                )}
                {loading ? <Text style={styles.buttonText}>Sending documents ({displayProgress}%)</Text> : <Text style={styles.buttonText}>Submit Application</Text>}
            </TouchableOpacity>
        </ScrollView>
    );

    const renderSuccess = () => (
        <ScrollView 
            contentContainerStyle={[styles.fullCenter, { paddingBottom: insets.bottom + 40 }]} 
            showsVerticalScrollIndicator={false}
        >
            <View style={[styles.iconCircle, { backgroundColor: '#10B98115' }]}>
                <CheckCircle2 size={48} color="#10B981" />
            </View>
            <Text style={[styles.gateTitle, { color: theme.text }]}>Application Submitted!</Text>
            <Text style={[styles.gateSub, { color: theme.textMuted }]}>
                Your driver application is now under review. We will notify you via email and app notification once your account is approved.
            </Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.accent }]} onPress={() => navigation.navigate('AccountMain')}>
                <Text style={styles.buttonText}>Back to Profile</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    const renderError = () => (
        <ScrollView 
            contentContainerStyle={[styles.fullCenter, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
        >
            <View style={[styles.iconCircle, { backgroundColor: '#EF444415' }]}>
                <FileText size={48} color="#EF4444" />
            </View>
            <Text style={[styles.gateTitle, { color: theme.text }]}>Submission Failed</Text>
            <Text style={[styles.gateSub, { color: theme.textMuted }]}>
                {error || 'Something went wrong while uploading your application. Please check your connection and try again.'}
            </Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: theme.accent }]} onPress={handleSubmit}>
                <Text style={styles.buttonText}>Retry Submission</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setError(null)}>
                <Text style={[styles.secondaryText, { color: theme.textMuted }]}>Edit Details</Text>
            </TouchableOpacity>
        </ScrollView>
    );

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, { backgroundColor: theme.background }]}>
            {error ? renderError() : (
                <>
                    {step === 0 && renderGate()}
                    {step === 1 && renderBasicInfo()}
                    {step === 2 && renderVehicle()}
                    {step === 3 && renderDocuments()}
                    {step === 4 && renderPayout()}
                    {step === 5 && renderSuccess()}
                </>
            )}
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    fullCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    iconCircle: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    gateTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 12 },
    gateSub: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
    primaryButton: { width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
    secondaryButton: { marginTop: 16, padding: 16 },
    secondaryText: { fontSize: 16, fontWeight: 'bold' },
    formContent: { flex: 1, padding: 24 },
    header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 32, marginTop: Platform.OS === 'ios' ? 40 : 20 },
    backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', marginRight: 16 },
    title: { fontSize: 24, fontWeight: 'bold' },
    subtitle: { fontSize: 14, marginTop: 4 },
    inputGroup: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 56, borderRadius: 16, marginBottom: 16 },
    input: { flex: 1, marginLeft: 12, fontSize: 16 },
    label: { fontSize: 14, fontWeight: 'bold', marginBottom: 8, marginLeft: 4 },
    row: { flexDirection: 'row', gap: 12 },
    typeCard: { flex: 1, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    typeText: { fontSize: 14, fontWeight: 'bold' },
    uploadBox: { height: 120, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc' },
    uploadText: { fontSize: 16, fontWeight: 'bold', marginTop: 12 },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, paddingRight: 24 },
    checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    termsText: { flex: 1, fontSize: 14, lineHeight: 20 },
    infoBanner: { padding: 16, borderRadius: 16 },
    infoText: { fontSize: 14, lineHeight: 20 },
    submitBtn: { width: '100%', height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
});
