/* eslint-disable prettier/prettier */
import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';
import Appointment from '../models/Appointment';
import User from '../models/User';
import File from '../models/File';
import Notification from '../schemas/Notification';
import Mail from '../../lib/Mail';

/* eslint-disable class-methods-use-this */
class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const apponitments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      order: ['date'],
      attributes: ['id', 'date'],
      limit: 20,
      offset: (page - 1) * 20,
      include: {
        model: User,
        as: 'provider',
        attributes: ['id', 'name'],
        include: [
          { model: File, as: 'avatar', attributes: ['id', 'path', 'url'] },
        ],
      },
    });

    return res.json(apponitments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.json(400).json({ error: 'Validation fails' });
    }

    const { provider_id, date } = req.body;

    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider) {
      return res
        .status(401)
        .json({ error: 'You can only create apponitments with providers' });
    }

    if( req.userId === provider_id){
      return res
        .status(401)
        .json({ error: 'You cannot make an appointment for yourself'});
    }

    const hourStart = startOfHour(parseISO(date));

    //  Past dates are not permitted
    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ error: 'Past date are not permitted' });
    }

    // Check availability
    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });

    if (checkAvailability) {
      return res
        .status(400)
        .json({ error: 'Appointment date are not available' });
    }
    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart,
    });

    // Notify apppointment provider
    const user = await User.findByPk(req.userId);

    const formattedDate = format(hourStart, "'dia' dd 'de' MMMM', às' H:mm'h'", {locale: pt});

    await Notification.create({
      content: `Nova agendamento de ${user.name} para o ${formattedDate}`,
      user: provider_id,
    });
    return res.json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes:['name'],
        }
      ],
    });

    if(appointment.user_id !== req.userId){
      return res.status(401).json({
        error: "You don't have permission to cancel this appointment."
      })
    }

    const dateWithSub = subHours(appointment.date, 2);

    if(isBefore(dateWithSub, new Date())){
      return res
      .status(401)
      .json({error: 'You can only cancel an appointment two hours before the schedule.'})
    }

    appointment.canceled_at = new Date();

    await appointment.save();

    await Mail.sendMail({
      to: `${appointment.provider.name} <${appointment.provider.email}>`,
      subject: 'Agendamento cancelado',
      template: 'cancellation',
      context: {
        provider: appointment.provider.name,
        user: appointment.user.name,
        date: format(appointment.date, "'dia' dd 'de' MMMM', às' H:mm'h'", {locale: pt}),
      }
    })

    return res.json(appointment);

  }
}

export default new AppointmentController();
